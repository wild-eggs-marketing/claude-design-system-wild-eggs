/**
 * SchemaInjector — Wild Eggs structured data / JSON-LD injector
 *
 * Injects schema.org JSON-LD into the page on publish. Zero visible output.
 * Canvas shows a debug badge. Drop once per page template, connect CMS fields.
 *
 * SSR strategy: always renders the <script> tag inline (hidden) so Framer's
 * static generator includes it in pre-rendered HTML. Also injects into <head>
 * via useEffect for client-side navigation. This dual approach ensures AI
 * crawlers (GPTBot, ClaudeBot, PerplexityBot) that don't execute JS see the
 * schema in the raw static HTML source.
 *
 * Supported schema types:
 *   restaurant — Restaurant + LocalBusiness + OpeningHoursSpecification
 *                + optional FAQPage + BreadcrumbList
 *   website    — WebSite + Organization (homepage / static pages)
 *   menu_page  — Menu + MenuSections + BreadcrumbList (for /menu page)
 *   blog_post  — BlogPosting + BreadcrumbList
 *   menu_item  — MenuItem + BreadcrumbList
 *
 * Hours defaults (Option A):
 *   opensWeekday = "06:30" — correct for 17 of 19 locations
 *   closesWeekday = "14:30"
 *   opensWeekend = "07:00"
 *   closesWeekend = "15:00"
 *   Exceptions (Oakley OH, Downtown Indianapolis IN) open at 07:00 weekdays.
 *   Override those two via CMS hours fields if/when added.
 *
 * CMS field IDs referenced (Locations collection):
 *   VE4M_IZd5  Location Name     YDBCfdVaG  Address Street
 *   MLDXsSKlw  City              Bals39mS8  State
 *   c2L1ndu9m  ZIP               dHvWK63eb  Phone
 *   rhJ78I93y  Latitude          hucWTEhPX  Longitude
 *   Eob6oDaLB  Google Maps URL   zqKTY3UCx  Order Online URL
 *   UTSB0cjwp  OG Image          eJfsQ96rK  Meta Description
 *   cTkHAJI8F  FAQ 1 Q           Wspcs4z27  FAQ 1 A
 *   Q_Xd2AGCg  FAQ 2 Q           cLpWFnhkM  FAQ 2 A
 *   BV98PRFWN  FAQ 3 Q           Ri8BOsdxu  FAQ 3 A
 *
 * CMS field IDs referenced (Blog collection):
 *   lFxkHazOU  Title             EwIxiGpKo  Meta Description
 *   jRqZPHFDl  Author Name       MVlv2Mk7n  Date
 *   ePtxQyu3M  Main Image
 *
 * CMS field IDs referenced (Menu Items collection):
 *   T1AgJrcWB  Title             nbsfKpHfS  Ingredients
 *   mqVPWrVZQ  Price - Medium    cHUmcyRnt  Category (enum name)
 *   uS7iNeSm_  Image
 *
 * @framerSupportedLayoutWidth fixed
 * @framerSupportedLayoutHeight fixed
 */

import { addPropertyControls, ControlType, RenderTarget } from "framer"
import { useEffect, useMemo, type CSSProperties } from "react"

// ─── Brand constants ──────────────────────────────────────────────────────────

const SITE_URL = "https://www.wildeggs.com"
const ORG_NAME = "Wild Eggs"
const ORG_LOGO =
    "https://framerusercontent.com/images/kxitRzaichdznlifxIwEpHGWOE.png"
const SERVES_CUISINE = ["American", "Breakfast", "Brunch", "Comfort Food"]
const PRICE_RANGE = "$$"
const SAME_AS = [
    "https://www.facebook.com/wildeggsrestaurants",
    "https://www.instagram.com/wildeggsrestaurants/",
]
const WEEKDAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"]
const WEEKEND = ["Saturday", "Sunday"]
const SCRIPT_PREFIX = "we-schema-injector"

const DIET_MAP: Record<string, string> = {
    "Gluten-friendly": "https://schema.org/GlutenFreeDiet",
    Vegetarian: "https://schema.org/VegetarianDiet",
    Vegan: "https://schema.org/VeganDiet",
    "Low Calorie": "https://schema.org/LowCalorieDiet",
}

const PATH_LABELS: Record<string, string> = {
    locations: "Locations",
    menu: "Menu",
    waitlist: "Waitlist",
    blog: "Blog",
    careers: "Careers",
    franchising: "Franchising",
    about: "About",
    catering: "Catering",
    rewards: "Rewards",
    contact: "Contact",
}

function labelForPathPart(part: string): string {
    return (
        PATH_LABELS[part] ||
        part.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())
    )
}

/** Offer.price must be numeric — strip currency symbols and stray text. */
function sanitizePrice(raw: string): string {
    const cleaned = raw.replace(/[^0-9.]/g, "")
    return /^\d+(\.\d+)?$/.test(cleaned) ? cleaned : ""
}

// ─── Types ────────────────────────────────────────────────────────────────────

type SchemaType =
    | "restaurant"
    | "website"
    | "menu_page"
    | "blog_post"
    | "menu_item"

interface Props {
    schemaType: SchemaType
    pageUrl: string
    metaDescription: string
    ogImage: string
    locationName: string
    addressStreet: string
    city: string
    state: string
    zip: string
    phone: string
    opensWeekday: string
    closesWeekday: string
    opensWeekend: string
    closesWeekend: string
    latitude: number
    longitude: number
    googleMapsUrl: string
    orderUrl: string
    enableRating: boolean
    ratingValue: number
    reviewCount: number
    enableFaq: boolean
    faq1Q: string
    faq1A: string
    faq2Q: string
    faq2A: string
    faq3Q: string
    faq3A: string
    blogTitle: string
    authorName: string
    datePublished: string
    dateModified: string
    menuItemName: string
    menuItemDescription: string
    menuItemPrice: string
    menuItemCategory: string
    style?: CSSProperties
}

// ─── Schema builders ──────────────────────────────────────────────────────────

function buildGraph(p: Props): object[] {
    switch (p.schemaType) {
        case "restaurant":
            return buildRestaurant(p)
        case "website":
            return buildWebsite(p)
        case "menu_page":
            return buildMenuPage(p)
        case "blog_post":
            return buildBlogPost(p)
        case "menu_item":
            return buildMenuItem(p)
        default:
            return []
    }
}

function buildRestaurant(p: Props): object[] {
    const graph: object[] = []

    const openingHours: object[] = []
    if (p.opensWeekday && p.closesWeekday) {
        openingHours.push({
            "@type": "OpeningHoursSpecification",
            dayOfWeek: WEEKDAYS,
            opens: p.opensWeekday,
            closes: p.closesWeekday,
        })
    }
    if (p.opensWeekend && p.closesWeekend) {
        openingHours.push({
            "@type": "OpeningHoursSpecification",
            dayOfWeek: WEEKEND,
            opens: p.opensWeekend,
            closes: p.closesWeekend,
        })
    }

    const restaurant: Record<string, unknown> = {
        "@type": ["Restaurant", "LocalBusiness"],
        "@id": p.pageUrl || `${SITE_URL}/locations`,
        name: p.locationName ? `${ORG_NAME} — ${p.locationName}` : ORG_NAME,
        url: p.pageUrl || `${SITE_URL}/locations`,
        servesCuisine: SERVES_CUISINE,
        priceRange: PRICE_RANGE,
        acceptsReservations: false,
        menu: `${SITE_URL}/menu`,
        sameAs: SAME_AS,
        parentOrganization: {
            "@type": "Organization",
            name: ORG_NAME,
            url: SITE_URL,
        },
    }

    if (p.metaDescription) restaurant.description = p.metaDescription
    if (p.phone) restaurant.telephone = p.phone
    if (p.ogImage) restaurant.image = p.ogImage
    if (p.googleMapsUrl) restaurant.hasMap = p.googleMapsUrl
    if (p.orderUrl) restaurant.orderUrl = p.orderUrl

    if (p.addressStreet && p.city && p.state && p.zip) {
        restaurant.address = {
            "@type": "PostalAddress",
            streetAddress: p.addressStreet,
            addressLocality: p.city,
            addressRegion: p.state,
            postalCode: p.zip,
            addressCountry: "US",
        }
    }

    if (p.latitude && p.longitude) {
        restaurant.geo = {
            "@type": "GeoCoordinates",
            latitude: p.latitude,
            longitude: p.longitude,
        }
    }

    if (openingHours.length > 0) {
        restaurant.openingHoursSpecification = openingHours
    }

    if (p.enableRating && p.ratingValue > 0 && p.reviewCount > 0) {
        restaurant.aggregateRating = {
            "@type": "AggregateRating",
            ratingValue: p.ratingValue,
            reviewCount: p.reviewCount,
            bestRating: 5,
            worstRating: 1,
        }
    }

    graph.push(restaurant)

    if (p.enableFaq) {
        const pairs: Array<[string, string]> = [
            [p.faq1Q, p.faq1A],
            [p.faq2Q, p.faq2A],
            [p.faq3Q, p.faq3A],
        ]
        const mainEntity = pairs
            .filter(([q, a]) => q && a)
            .map(([q, a]) => ({
                "@type": "Question",
                name: q,
                acceptedAnswer: { "@type": "Answer", text: a },
            }))

        if (mainEntity.length > 0) {
            graph.push({ "@type": "FAQPage", mainEntity })
        }
    }

    if (p.pageUrl && p.locationName) {
        graph.push({
            "@type": "BreadcrumbList",
            itemListElement: [
                {
                    "@type": "ListItem",
                    position: 1,
                    name: "Home",
                    item: SITE_URL,
                },
                {
                    "@type": "ListItem",
                    position: 2,
                    name: "Locations",
                    item: `${SITE_URL}/locations`,
                },
                {
                    "@type": "ListItem",
                    position: 3,
                    name: p.locationName,
                    item: p.pageUrl,
                },
            ],
        })
    }

    return graph
}

function buildWebsite(p: Props): object[] {
    const graph: object[] = [
        {
            "@type": "WebSite",
            "@id": `${SITE_URL}/#website`,
            name: ORG_NAME,
            url: SITE_URL,
            inLanguage: "en-US",
            description:
                p.metaDescription ||
                "Wild Eggs serves breakfast, brunch, and lunch across Kentucky, Indiana, and Ohio. Scratch kitchen. Locally sourced. Family friendly.",
            potentialAction: {
                "@type": "SearchAction",
                target: `${SITE_URL}/locations?search={search_term_string}`,
                "query-input": "required name=search_term_string",
            },
        },
        {
            "@type": "Organization",
            "@id": `${SITE_URL}/#organization`,
            name: ORG_NAME,
            url: SITE_URL,
            logo: {
                "@type": "ImageObject",
                "@id": `${SITE_URL}/#logo`,
                url: ORG_LOGO,
                caption: "Wild Eggs",
            },
            sameAs: SAME_AS,
            contactPoint: {
                "@type": "ContactPoint",
                contactType: "customer service",
                url: `${SITE_URL}/contact`,
                availableLanguage: "English",
            },
        },
    ]

    if (p.pageUrl && p.pageUrl !== SITE_URL) {
        const pathParts = p.pageUrl
            .replace(SITE_URL, "")
            .split("/")
            .filter(Boolean)
        const lastPart = pathParts[pathParts.length - 1]
        const pageName = lastPart
            ? `${labelForPathPart(lastPart)} | ${ORG_NAME}`
            : ORG_NAME

        graph.push({
            "@type": "WebPage",
            "@id": `${p.pageUrl}#webpage`,
            url: p.pageUrl,
            name: pageName,
            description: p.metaDescription || undefined,
            isPartOf: { "@id": `${SITE_URL}/#website` },
            publisher: { "@id": `${SITE_URL}/#organization` },
            inLanguage: "en-US",
        })

        if (pathParts.length > 0) {
            const breadcrumbs: object[] = [
                {
                    "@type": "ListItem",
                    position: 1,
                    name: "Home",
                    item: SITE_URL,
                },
            ]
            pathParts.forEach((part, i) => {
                breadcrumbs.push({
                    "@type": "ListItem",
                    position: i + 2,
                    name: labelForPathPart(part),
                    item: `${SITE_URL}/${pathParts.slice(0, i + 1).join("/")}`,
                })
            })
            graph.push({
                "@type": "BreadcrumbList",
                itemListElement: breadcrumbs,
            })
        }
    }

    return graph
}

function buildMenuPage(p: Props): object[] {
    const graph: object[] = [
        {
            "@type": "Menu",
            "@id": `${SITE_URL}/menu#menu`,
            name: "Wild Eggs Menu",
            url: `${SITE_URL}/menu`,
            description:
                p.metaDescription ||
                "Wild Eggs full breakfast and brunch menu featuring egg classics, benedicts, pancakes, omelets, skillets, burgers, sides, coffee, and brunch cocktails.",
            inLanguage: "en",
            publisher: {
                "@type": "Organization",
                name: ORG_NAME,
                url: SITE_URL,
            },
            hasMenuSection: [
                {
                    "@type": "MenuSection",
                    name: "Wild Eggs Creations",
                    description: "Chef's specialties and Wild Eggs originals",
                },
                {
                    "@type": "MenuSection",
                    name: "Bonnie's Bennies",
                    description:
                        "Eggs Benedict with housemade hollandaise, served with your choice of side",
                },
                {
                    "@type": "MenuSection",
                    name: "Breakfast Basics and Shareables",
                    description: "Fresh, made-to-order breakfast classics",
                },
                {
                    "@type": "MenuSection",
                    name: "4-Egg Omelets",
                    description: "Four-egg omelets your way — build your own",
                },
                {
                    "@type": "MenuSection",
                    name: "Pancakes & French Toast",
                    description: "Housemade batter with fresh toppings daily",
                },
                {
                    "@type": "MenuSection",
                    name: "Burgers, Sandwiches, and Salads",
                    description:
                        "Hand-crafted lunch options with daily specials",
                },
                {
                    "@type": "MenuSection",
                    name: "Sides",
                    description: "Add to any plate, mix and match",
                },
                {
                    "@type": "MenuSection",
                    name: "Coffee & Drinks",
                    description: "Locally sourced, barista crafted daily",
                },
                {
                    "@type": "MenuSection",
                    name: "Wild Juices and Drinks",
                    description: "Always fresh, always refreshing",
                },
                {
                    "@type": "MenuSection",
                    name: "Wild Spirits",
                    description: "Brunch cocktails and seasonal sips",
                },
            ],
        },
        {
            "@type": "BreadcrumbList",
            itemListElement: [
                {
                    "@type": "ListItem",
                    position: 1,
                    name: "Home",
                    item: SITE_URL,
                },
                {
                    "@type": "ListItem",
                    position: 2,
                    name: "Menu",
                    item: `${SITE_URL}/menu`,
                },
            ],
        },
    ]
    return graph
}

function buildBlogPost(p: Props): object[] {
    const post: Record<string, unknown> = {
        "@type": "BlogPosting",
        "@id": p.pageUrl ? `${p.pageUrl}#article` : undefined,
        url: p.pageUrl || undefined,
        inLanguage: "en-US",
        headline: p.blogTitle || undefined,
        description: p.metaDescription || undefined,
        image: p.ogImage || undefined,
        publisher: {
            "@type": "Organization",
            name: ORG_NAME,
            logo: { "@type": "ImageObject", url: ORG_LOGO },
        },
        mainEntityOfPage: {
            "@type": "WebPage",
            "@id": p.pageUrl || SITE_URL,
        },
    }

    if (p.datePublished) post.datePublished = p.datePublished
    if (p.dateModified || p.datePublished)
        post.dateModified = p.dateModified || p.datePublished

    post.author = p.authorName
        ? { "@type": "Person", name: p.authorName }
        : { "@type": "Organization", name: ORG_NAME, url: SITE_URL }

    const graph: object[] = [post]

    if (p.pageUrl && p.blogTitle) {
        graph.push({
            "@type": "BreadcrumbList",
            itemListElement: [
                {
                    "@type": "ListItem",
                    position: 1,
                    name: "Home",
                    item: SITE_URL,
                },
                {
                    "@type": "ListItem",
                    position: 2,
                    name: "Blog",
                    item: `${SITE_URL}/blog`,
                },
                {
                    "@type": "ListItem",
                    position: 3,
                    name: p.blogTitle,
                    item: p.pageUrl,
                },
            ],
        })
    }

    return graph
}

function buildMenuItem(p: Props): object[] {
    const item: Record<string, unknown> = {
        "@type": "MenuItem",
        "@id": p.pageUrl ? `${p.pageUrl}#menuitem` : undefined,
        name: p.menuItemName || undefined,
        description: p.menuItemDescription || undefined,
        image: p.ogImage || undefined,
    }

    const numericPrice = sanitizePrice(p.menuItemPrice || "")
    if (numericPrice) {
        item.offers = {
            "@type": "Offer",
            price: numericPrice,
            priceCurrency: "USD",
            availability: "https://schema.org/InStock",
        }
    }

    if (p.menuItemCategory && DIET_MAP[p.menuItemCategory]) {
        item.suitableForDiet = DIET_MAP[p.menuItemCategory]
    }

    const graph: object[] = [item]

    if (p.pageUrl && p.menuItemName) {
        graph.push({
            "@type": "BreadcrumbList",
            itemListElement: [
                {
                    "@type": "ListItem",
                    position: 1,
                    name: "Home",
                    item: SITE_URL,
                },
                {
                    "@type": "ListItem",
                    position: 2,
                    name: "Menu",
                    item: `${SITE_URL}/menu`,
                },
                {
                    "@type": "ListItem",
                    position: 3,
                    name: p.menuItemName,
                    item: p.pageUrl,
                },
            ],
        })
    }

    return graph
}

// ─── Canvas badge ─────────────────────────────────────────────────────────────

const TYPE_LABELS: Record<SchemaType, string> = {
    restaurant: "Restaurant + LocalBusiness",
    website: "WebSite + Organization",
    menu_page: "Menu + MenuSections",
    blog_post: "BlogPosting",
    menu_item: "MenuItem",
}

function CanvasBadge({
    schemaType,
    preview,
    count,
}: {
    schemaType: SchemaType
    preview: string
    count: number
}) {
    return (
        <div
            style={{
                position: "relative",
                display: "flex",
                flexDirection: "column",
                alignItems: "flex-start",
                justifyContent: "center",
                gap: 4,
                padding: "8px 12px",
                background: "rgba(47, 92, 100, 0.08)",
                border: "1.5px dashed rgb(47, 92, 100)",
                borderRadius: 6,
                pointerEvents: "none",
                width: "100%",
                height: "100%",
                boxSizing: "border-box",
                overflow: "hidden",
            }}
        >
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <div
                    style={{
                        width: 7,
                        height: 7,
                        borderRadius: "50%",
                        background: "#2f5c64",
                        flexShrink: 0,
                    }}
                />
                <span
                    style={{
                        fontFamily: "monospace",
                        fontSize: 10,
                        fontWeight: 700,
                        color: "#2f5c64",
                        letterSpacing: "0.04em",
                        whiteSpace: "nowrap",
                    }}
                >
                    JSON-LD · {TYPE_LABELS[schemaType]}
                </span>
            </div>
            <span
                style={{
                    fontFamily: "monospace",
                    fontSize: 9,
                    color: "#5b787c",
                    whiteSpace: "nowrap",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    maxWidth: "100%",
                }}
            >
                {preview || "← connect CMS fields in properties panel"}
            </span>
            <span
                style={{
                    fontFamily: "monospace",
                    fontSize: 9,
                    color: "#9ab0b4",
                }}
            >
                {count} schema block{count !== 1 ? "s" : ""} · injects on
                publish
            </span>
        </div>
    )
}

// ─── Main component ───────────────────────────────────────────────────────────

/**
 * @framerSupportedLayoutWidth fixed
 * @framerSupportedLayoutHeight fixed
 */
export default function SchemaInjector(props: Props) {
    const {
        schemaType = "restaurant",
        pageUrl = "",
        metaDescription = "",
        ogImage = "",
        locationName = "",
        addressStreet = "",
        city = "",
        state = "",
        zip = "",
        phone = "",
        opensWeekday = "06:30",
        closesWeekday = "14:30",
        opensWeekend = "07:00",
        closesWeekend = "15:00",
        latitude = 0,
        longitude = 0,
        googleMapsUrl = "",
        orderUrl = "",
        enableRating = false,
        ratingValue = 0,
        reviewCount = 0,
        enableFaq = false,
        faq1Q = "",
        faq1A = "",
        faq2Q = "",
        faq2A = "",
        faq3Q = "",
        faq3A = "",
        blogTitle = "",
        authorName = "",
        datePublished = "",
        dateModified = "",
        menuItemName = "",
        menuItemDescription = "",
        menuItemPrice = "",
        menuItemCategory = "",
    } = props

    const isCanvas = RenderTarget.current() === RenderTarget.canvas

    const { schemaJson, count, scriptId } = useMemo(() => {
        const graph = buildGraph(props)
        const payload = {
            "@context": "https://schema.org",
            "@graph": graph,
        }
        const id = `${SCRIPT_PREFIX}-${schemaType}-${encodeURIComponent(pageUrl || "default")}`
        return {
            schemaJson: JSON.stringify(payload),
            count: graph.length,
            scriptId: id,
        }
    }, [
        schemaType,
        pageUrl,
        metaDescription,
        ogImage,
        locationName,
        addressStreet,
        city,
        state,
        zip,
        phone,
        opensWeekday,
        closesWeekday,
        opensWeekend,
        closesWeekend,
        latitude,
        longitude,
        googleMapsUrl,
        orderUrl,
        enableRating,
        ratingValue,
        reviewCount,
        enableFaq,
        faq1Q,
        faq1A,
        faq2Q,
        faq2A,
        faq3Q,
        faq3A,
        blogTitle,
        authorName,
        datePublished,
        dateModified,
        menuItemName,
        menuItemDescription,
        menuItemPrice,
        menuItemCategory,
    ])

    // Client-side: also inject into <head> so schema is available after
    // client-side navigation (Framer SPA routing).
    useEffect(() => {
        if (typeof document === "undefined") return
        const existing = document.getElementById(scriptId)
        if (existing) existing.remove()
        const script = document.createElement("script")
        script.id = scriptId
        script.type = "application/ld+json"
        script.textContent = schemaJson
        document.head.appendChild(script)
        return () => {
            const el = document.getElementById(scriptId)
            if (el) el.remove()
        }
    }, [schemaJson, scriptId])

    // Canvas: show badge
    if (isCanvas) {
        const preview =
            schemaType === "restaurant"
                ? locationName
                : schemaType === "blog_post"
                  ? blogTitle
                  : schemaType === "menu_item"
                    ? menuItemName
                    : pageUrl || SITE_URL
        return (
            <div
                style={{
                    ...props.style,
                    position: "relative",
                    width: "100%",
                    height: "100%",
                }}
            >
                <CanvasBadge
                    schemaType={schemaType}
                    preview={preview}
                    count={count}
                />
            </div>
        )
    }

    // Published (SSR + client): render the <script> tag inline, hidden.
    // Always rendering inline means Framer's static generator includes it
    // in the pre-rendered HTML, making it visible to AI crawlers that
    // don't execute JavaScript.
    return (
        <div
            style={{
                position: "absolute",
                width: 0,
                height: 0,
                overflow: "hidden",
                visibility: "hidden",
                pointerEvents: "none",
            }}
            aria-hidden="true"
        >
            <script
                id={scriptId}
                type="application/ld+json"
                dangerouslySetInnerHTML={{ __html: schemaJson }}
            />
        </div>
    )
}

// ─── Property controls ────────────────────────────────────────────────────────

const notRestaurant = ({ schemaType }: any) => schemaType !== "restaurant"
const notBlog = ({ schemaType }: any) => schemaType !== "blog_post"
const notMenuItem = ({ schemaType }: any) => schemaType !== "menu_item"
const notFaqSection = ({ schemaType, enableFaq }: any) =>
    schemaType !== "restaurant" || !enableFaq
const notRatingSection = ({ schemaType, enableRating }: any) =>
    schemaType !== "restaurant" || !enableRating

addPropertyControls(SchemaInjector, {
    schemaType: {
        type: ControlType.Enum,
        title: "Schema Type",
        defaultValue: "restaurant",
        options: [
            "restaurant",
            "website",
            "menu_page",
            "blog_post",
            "menu_item",
        ],
        optionTitles: [
            "Restaurant / Location",
            "WebSite + WebPage (non-menu pages)",
            "Menu Page (/menu)",
            "Blog Post",
            "Menu Item",
        ],
    },
    pageUrl: {
        type: ControlType.String,
        title: "Page URL",
        defaultValue: "",
        placeholder: "https://www.wildeggs.com/locations/east-louisville",
        description:
            "Full URL of this page. On location/blog/menu templates, construct via CMS slug + base URL.",
    },
    metaDescription: {
        type: ControlType.String,
        title: "Description",
        defaultValue: "",
        displayTextArea: true,
        description: "Connect to Meta Description CMS field.",
    },
    ogImage: {
        type: ControlType.String,
        title: "OG Image URL",
        defaultValue: "",
        description: "Connect to Og Image CMS field (UTSB0cjwp).",
    },
    locationName: {
        type: ControlType.String,
        title: "Location Name",
        defaultValue: "",
        placeholder: "East Louisville",
        description: "Connect to Location Name (VE4M_IZd5).",
        hidden: notRestaurant,
    },
    addressStreet: {
        type: ControlType.String,
        title: "Street Address",
        defaultValue: "",
        placeholder: "3717 Lexington Rd",
        description: "Connect to Address Street (YDBCfdVaG).",
        hidden: notRestaurant,
    },
    city: {
        type: ControlType.String,
        title: "City",
        defaultValue: "",
        placeholder: "Louisville",
        description: "Connect to City (MLDXsSKlw).",
        hidden: notRestaurant,
    },
    state: {
        type: ControlType.String,
        title: "State",
        defaultValue: "KY",
        placeholder: "KY",
        description: "Connect to State (Bals39mS8).",
        hidden: notRestaurant,
    },
    zip: {
        type: ControlType.String,
        title: "ZIP Code",
        defaultValue: "",
        placeholder: "40206",
        description: "Connect to Address Zip (c2L1ndu9m).",
        hidden: notRestaurant,
    },
    phone: {
        type: ControlType.String,
        title: "Phone",
        defaultValue: "",
        placeholder: "+15025551234",
        description:
            "Connect to Phone (dHvWK63eb). Use E.164 format: +1XXXXXXXXXX",
        hidden: notRestaurant,
    },
    opensWeekday: {
        type: ControlType.String,
        title: "Opens (Mon-Fri)",
        defaultValue: "06:30",
        description:
            "24h format. Default 06:30 covers 17/19 locations. Oakley and Downtown Indy open at 07:00 — override via CMS if hours fields are added.",
        hidden: notRestaurant,
    },
    closesWeekday: {
        type: ControlType.String,
        title: "Closes (Mon-Fri)",
        defaultValue: "14:30",
        description: "24h format. Default: 14:30",
        hidden: notRestaurant,
    },
    opensWeekend: {
        type: ControlType.String,
        title: "Opens (Sat-Sun)",
        defaultValue: "07:00",
        description: "24h format. Default: 07:00",
        hidden: notRestaurant,
    },
    closesWeekend: {
        type: ControlType.String,
        title: "Closes (Sat-Sun)",
        defaultValue: "15:00",
        description: "24h format. Default: 15:00",
        hidden: notRestaurant,
    },
    latitude: {
        type: ControlType.Number,
        title: "Latitude",
        defaultValue: 0,
        step: 0.0001,
        description: "Connect to Latitude (rhJ78I93y).",
        hidden: notRestaurant,
    },
    longitude: {
        type: ControlType.Number,
        title: "Longitude",
        defaultValue: 0,
        step: 0.0001,
        description: "Connect to Longitude (hucWTEhPX).",
        hidden: notRestaurant,
    },
    googleMapsUrl: {
        type: ControlType.String,
        title: "Google Maps URL",
        defaultValue: "",
        description: "Connect to Google Maps Url (Eob6oDaLB).",
        hidden: notRestaurant,
    },
    orderUrl: {
        type: ControlType.String,
        title: "Order Online URL",
        defaultValue: "",
        description: "Connect to Order Online Url (zqKTY3UCx).",
        hidden: notRestaurant,
    },
    enableRating: {
        type: ControlType.Boolean,
        title: "Include Rating",
        defaultValue: false,
        enabledTitle: "Yes",
        disabledTitle: "No",
        description:
            "Adds aggregateRating — unlocks star rich results in Google SERPs.",
        hidden: notRestaurant,
    },
    ratingValue: {
        type: ControlType.Number,
        title: "Rating Value",
        defaultValue: 0,
        min: 1,
        max: 5,
        step: 0.1,
        description:
            "e.g. 4.5 — connect to a CMS rating field or enter manually.",
        hidden: notRatingSection,
    },
    reviewCount: {
        type: ControlType.Number,
        title: "Review Count",
        defaultValue: 0,
        min: 1,
        step: 1,
        description:
            "Total number of reviews. Connect to CMS or enter manually.",
        hidden: notRatingSection,
    },
    enableFaq: {
        type: ControlType.Boolean,
        title: "Include FAQPage",
        defaultValue: false,
        enabledTitle: "Yes",
        disabledTitle: "No",
        description: "Appends a FAQPage schema alongside Restaurant.",
        hidden: notRestaurant,
    },
    faq1Q: {
        type: ControlType.String,
        title: "FAQ 1 — Question",
        defaultValue: "",
        displayTextArea: true,
        description: "Connect to Faq 1 Q (cTkHAJI8F).",
        hidden: notFaqSection,
    },
    faq1A: {
        type: ControlType.String,
        title: "FAQ 1 — Answer",
        defaultValue: "",
        displayTextArea: true,
        description: "Connect to Faq 1 A (Wspcs4z27).",
        hidden: notFaqSection,
    },
    faq2Q: {
        type: ControlType.String,
        title: "FAQ 2 — Question",
        defaultValue: "",
        displayTextArea: true,
        description: "Connect to Faq 2 Q (Q_Xd2AGCg).",
        hidden: notFaqSection,
    },
    faq2A: {
        type: ControlType.String,
        title: "FAQ 2 — Answer",
        defaultValue: "",
        displayTextArea: true,
        description: "Connect to Faq 2 A (cLpWFnhkM).",
        hidden: notFaqSection,
    },
    faq3Q: {
        type: ControlType.String,
        title: "FAQ 3 — Question",
        defaultValue: "",
        displayTextArea: true,
        description: "Connect to Faq 3 Q (BV98PRFWN).",
        hidden: notFaqSection,
    },
    faq3A: {
        type: ControlType.String,
        title: "FAQ 3 — Answer",
        defaultValue: "",
        displayTextArea: true,
        description: "Connect to Faq 3 A (Ri8BOsdxu).",
        hidden: notFaqSection,
    },
    blogTitle: {
        type: ControlType.String,
        title: "Post Title",
        defaultValue: "",
        description: "Connect to Title (lFxkHazOU).",
        hidden: notBlog,
    },
    authorName: {
        type: ControlType.String,
        title: "Author Name",
        defaultValue: "",
        placeholder: "Wild Eggs Team",
        description:
            "Connect to Author Name (jRqZPHFDl). Blank = Organization.",
        hidden: notBlog,
    },
    datePublished: {
        type: ControlType.String,
        title: "Date Published",
        defaultValue: "",
        placeholder: "2025-06-01T07:00:00.000Z",
        description: "Connect to Date (MVlv2Mk7n). ISO 8601 format.",
        hidden: notBlog,
    },
    dateModified: {
        type: ControlType.String,
        title: "Date Modified",
        defaultValue: "",
        placeholder: "2025-06-15T07:00:00.000Z",
        description: "Leave blank to fall back to Date Published.",
        hidden: notBlog,
    },
    menuItemName: {
        type: ControlType.String,
        title: "Item Name",
        defaultValue: "",
        description: "Connect to Title (T1AgJrcWB).",
        hidden: notMenuItem,
    },
    menuItemDescription: {
        type: ControlType.String,
        title: "Ingredients / Description",
        defaultValue: "",
        displayTextArea: true,
        description:
            "Connect to Ingredients (nbsfKpHfS). Strip HTML tags if needed.",
        hidden: notMenuItem,
    },
    menuItemPrice: {
        type: ControlType.String,
        title: "Price",
        defaultValue: "",
        placeholder: "12.99",
        description:
            "Connect to Price - Medium (mqVPWrVZQ). \"$\" and text are stripped automatically.",
        hidden: notMenuItem,
    },
    menuItemCategory: {
        type: ControlType.String,
        title: "Category",
        defaultValue: "",
        placeholder: "Breakfast Mains",
        description: "Connect to Category enum display name (cHUmcyRnt).",
        hidden: notMenuItem,
    },
})
