//! Curated RSS feeds sourced from https://github.com/plenaryapp/awesome-rss-feeds
//! ~500 feeds across 30+ categories.

use serde::{Deserialize, Serialize};
use std::collections::HashSet;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CuratedFeed {
    pub title: String,
    pub feed_url: String,
    pub site_url: String,
    pub category: String,
}

pub fn get_curated_feeds() -> Vec<CuratedFeed> {
    let mut feeds = vec![
        // ===== NEWS (22) =====
        cf("BBC News", "http://feeds.bbci.co.uk/news/rss.xml", "https://www.bbc.co.uk/news", "News"),
        cf("BBC World", "http://feeds.bbci.co.uk/news/world/rss.xml", "https://www.bbc.co.uk/news/world", "News"),
        cf("CNN", "http://rss.cnn.com/rss/edition.rss", "https://edition.cnn.com", "News"),
        cf("CNN World", "http://rss.cnn.com/rss/edition_world.rss", "https://edition.cnn.com/world", "News"),
        cf("New York Times", "https://rss.nytimes.com/services/xml/rss/nyt/HomePage.xml", "https://www.nytimes.com", "News"),
        cf("NYT World", "https://rss.nytimes.com/services/xml/rss/nyt/World.xml", "https://www.nytimes.com/world", "News"),
        cf("The Guardian", "https://www.theguardian.com/world/rss", "https://www.theguardian.com", "News"),
        cf("Washington Post", "http://feeds.washingtonpost.com/rss/world", "https://www.washingtonpost.com", "News"),
        cf("Google News", "https://news.google.com/rss", "https://news.google.com", "News"),
        cf("Reuters", "https://feeds.reuters.com/reuters/topNews", "https://www.reuters.com", "News"),
        cf("Associated Press", "https://apnews.com/rss/apf-topnews.xml", "https://apnews.com", "News"),
        cf("NPR", "https://feeds.npr.org/1001/rss.xml", "https://www.npr.org", "News"),
        cf("Al Jazeera", "https://www.aljazeera.com/xml/rss/all.xml", "https://www.aljazeera.com", "News"),
        cf("CNBC", "https://www.cnbc.com/id/100003114/device/rss/rss.html", "https://www.cnbc.com", "News"),
        cf("Politico", "https://rss.politico.com/politics08.xml", "https://www.politico.com", "News"),
        cf("Axios", "https://api.axios.com/feed/", "https://www.axios.com", "News"),
        cf("The Hill", "https://thehill.com/feed/", "https://thehill.com", "News"),
        cf("Sky News", "https://feeds.skynews.com/feeds/rss/home.xml", "https://news.sky.com", "News"),
        cf("NBC News", "https://feeds.nbcnews.com/nbcnews/public/news", "https://www.nbcnews.com", "News"),
        cf("ABC News", "https://abcnews.go.com/rss", "https://abcnews.go.com", "News"),
        cf("USA Today", "https://rss.usatoday.com/usatodaycomNews-topStories", "https://www.usatoday.com", "News"),
        cf("Fox News", "http://feeds.foxnews.com/foxnews/latest", "https://www.foxnews.com", "News"),

        // ===== TECH (22) =====
        cf("Hacker News", "https://news.ycombinator.com/rss", "https://news.ycombinator.com", "Tech"),
        cf("TechCrunch", "http://feeds.feedburner.com/TechCrunch", "https://techcrunch.com", "Tech"),
        cf("The Verge", "https://www.theverge.com/rss/index.xml", "https://www.theverge.com", "Tech"),
        cf("Ars Technica", "http://feeds.arstechnica.com/arstechnica/index", "https://arstechnica.com", "Tech"),
        cf("Wired", "https://www.wired.com/feed/rss", "https://www.wired.com", "Tech"),
        cf("Engadget", "https://www.engadget.com/rss.xml", "https://www.engadget.com", "Tech"),
        cf("The Next Web", "https://thenextweb.com/feed", "https://thenextweb.com", "Tech"),
        cf("Gizmodo", "https://gizmodo.com/rss", "https://gizmodo.com", "Tech"),
        cf("Mashable", "http://feeds.mashable.com/Mashable", "https://mashable.com", "Tech"),
        cf("Lifehacker", "https://lifehacker.com/rss", "https://lifehacker.com", "Tech"),
        cf("Slashdot", "http://rss.slashdot.org/Slashdot/slashdotMain", "https://slashdot.org", "Tech"),
        cf("CNET", "https://www.cnet.com/rss/news/", "https://www.cnet.com", "Tech"),
        cf("ZDNet", "https://www.zdnet.com/rss.xml", "https://www.zdnet.com", "Tech"),
        cf("Tom's Hardware", "https://www.tomshardware.com/feeds/all", "https://www.tomshardware.com", "Tech"),
        cf("The Register", "https://www.theregister.com/headlines/feed", "https://www.theregister.com", "Tech"),
        cf("AnandTech", "https://www.anandtech.com/rss/", "https://www.anandtech.com", "Tech"),
        cf("9to5Mac", "https://9to5mac.com/feed", "https://9to5mac.com", "Tech"),
        cf("MacRumors", "http://feeds.macrumors.com/MacRumors-Mac", "https://macrumors.com", "Tech"),
        cf("MacStories", "https://www.macstories.net/feed", "https://www.macstories.net", "Tech"),
        cf("Stratechery", "http://stratechery.com/feed/", "https://stratechery.com", "Tech"),
        cf("a]6z", "https://a]6z.com/feed/", "https://a]6z.com", "Tech"),
        cf("The Information", "https://www.theinformation.com/feed", "https://www.theinformation.com", "Tech"),
        cf("Platformer", "https://www.platformer.news/feed/", "https://www.platformer.news", "Tech"),

        // ===== SCIENCE (16) =====
        cf("Scientific American", "https://www.scientificamerican.com/feed/", "https://www.scientificamerican.com", "Science"),
        cf("Nature", "https://www.nature.com/nature.rss", "https://www.nature.com", "Science"),
        cf("ScienceDaily", "https://www.sciencedaily.com/rss/all.xml", "https://www.sciencedaily.com", "Science"),
        cf("BBC Science", "http://feeds.bbci.co.uk/news/science_and_environment/rss.xml", "https://www.bbc.co.uk/news/science", "Science"),
        cf("Wired Science", "https://www.wired.com/feed/category/science/latest/rss", "https://www.wired.com/science", "Science"),
        cf("Phys.org", "https://phys.org/rss-feed/", "https://phys.org", "Science"),
        cf("Space.com", "https://www.space.com/feeds/all", "https://www.space.com", "Science"),
        cf("NASA", "https://www.nasa.gov/rss/dyn/breaking_news.rss", "https://www.nasa.gov", "Science"),
        cf("New Scientist", "https://www.newscientist.com/feed/", "https://www.newscientist.com", "Science"),
        cf("Quanta Magazine", "https://api.quantamagazine.org/feed/v1", "https://www.quantamagazine.org", "Science"),
        cf("Nautilus", "https://nautil.us/feed/", "https://nautil.us", "Science"),
        cf("Discover Magazine", "https://www.discovermagazine.com/feed/", "https://www.discovermagazine.com", "Science"),
        cf("Smithsonian", "https://www.smithsonianmag.com/feed/", "https://www.smithsonianmag.com", "Science"),
        cf("Science News", "https://www.sciencenews.org/feed", "https://www.sciencenews.org", "Science"),
        cf("Live Science", "https://www.livescience.com/feed", "https://www.livescience.com", "Science"),

        // ===== PROGRAMMING (18) =====
        cf("GitHub Blog", "https://github.blog/feed/", "https://github.blog", "Programming"),
        cf("Stack Overflow Blog", "https://stackoverflow.blog/feed/", "https://stackoverflow.blog", "Programming"),
        cf("CSS-Tricks", "https://css-tricks.com/feed/", "https://css-tricks.com", "Programming"),
        cf("Smashing Magazine", "https://www.smashingmagazine.com/feed", "https://www.smashingmagazine.com", "Programming"),
        cf("A List Apart", "https://alistapart.com/main/feed/", "https://alistapart.com", "Programming"),
        cf("Dev.to", "https://dev.to/feed/", "https://dev.to", "Programming"),
        cf("InfoQ", "https://feed.infoq.com", "https://www.infoq.com", "Programming"),
        cf("Martin Fowler", "https://martinfowler.com/feed.atom", "https://martinfowler.com", "Programming"),
        cf("Overreacted (Dan Abramov)", "https://overreacted.io/rss.xml", "https://overreacted.io", "Programming"),
        cf("Coding Horror", "https://feeds.feedburner.com/codinghorror", "https://blog.codinghorror.com", "Programming"),
        cf("Joel on Software", "https://www.joelonsoftware.com/feed/", "https://www.joelonsoftware.com", "Programming"),
        cf("Hacker Noon", "https://medium.com/feed/hackernoon", "https://hackernoon.com", "Programming"),
        cf("Better Programming", "https://medium.com/feed/better-programming", "https://betterprogramming.pub", "Programming"),
        cf("The Pragmatic Engineer", "https://pragmaticengineer.io/feed/", "https://pragmaticengineer.io", "Programming"),
        cf("ByteByte", "https://blog.bytebyte.com/feed.xml", "https://blog.bytebyte.com", "Programming"),
        cf("LogRocket Blog", "https://blog.logrocket.com/feed", "https://blog.logrocket.com", "Programming"),

        // ===== BUSINESS & FINANCE (16) =====
        cf("Bloomberg", "https://www.bloomberg.com/feed", "https://www.bloomberg.com", "Business & Finance"),
        cf("Forbes", "https://www.forbes.com/business/feed/", "https://www.forbes.com/business", "Business & Finance"),
        cf("CNBC", "https://www.cnbc.com/id/100003114/device/rss/rss.html", "https://www.cnbc.com", "Business & Finance"),
        cf("Financial Times", "https://www.ft.com/rss/home", "https://www.ft.com", "Business & Finance"),
        cf("The Economist", "https://www.economist.com/rss/all_feed.xml", "https://www.economist.com", "Business & Finance"),
        cf("Wall Street Journal", "https://feeds.a.dj.com/rss/RSSWorldNews.xml", "https://www.wsj.com", "Business & Finance"),
        cf("Fortune", "https://fortune.com/feed", "https://fortune.com", "Business & Finance"),
        cf("Harvard Business Review", "https://hbr.org/feed", "https://hbr.org", "Business & Finance"),
        cf("Inc.com", "https://www.inc.com/rss/", "https://www.inc.com", "Business & Finance"),
        cf("Fast Company", "https://www.fastcompany.com/feed", "https://www.fastcompany.com", "Business & Finance"),
        cf("Business Insider", "https://www.businessinsider.com/rss", "https://www.businessinsider.com", "Business & Finance"),
        cf("Markets Insider", "https://markets.businessinsider.com/feed", "https://markets.businessinsider.com", "Business & Finance"),
        cf("Investing.com", "https://www.investing.com/rss/news.rss", "https://www.investing.com", "Business & Finance"),
        cf("Seeking Alpha", "https://seekingalpha.com/market_currents.xml", "https://seekingalpha.com", "Business & Finance"),
        cf("Yahoo Finance", "https://finance.yahoo.com/news/rssindex", "https://finance.yahoo.com", "Business & Finance"),

        // ===== STARTUPS (14) =====
        cf("Product Hunt", "https://www.producthunt.com/feed", "https://www.producthunt.com", "Startups"),
        cf("VentureBeat", "https://feeds.feedburner.com/venturebeat/SZYF", "https://venturebeat.com", "Startups"),
        cf("Paul Graham Essays", "http://www.aaronsw.com/2002/feeds/pgessays.rss", "https://paulgraham.com", "Startups"),
        cf("Both Sides of the Table", "https://bothsidesofthetable.com/feed", "https://bothsidesofthetable.com", "Startups"),
        cf("AVC", "https://avc.com/feed/", "https://avc.com", "Startups"),
        cf("Feld Thoughts", "https://feld.com/feed", "https://feld.com", "Startups"),
        cf("TechCrunch", "https://techcrunch.com/category/startups/feed", "https://techcrunch.com", "Startups"),
        cf("The Hustle", "https://thehustle.co/feed", "https://thehustle.co", "Startups"),
        cf("SaaStr", "https://www.saastr.com/feed/", "https://www.saastr.com", "Startups"),
        cf("Y Combinator", "https://news.ycombinator.com/rss", "https://news.ycombinator.com", "Startups"),
        cf("AngelList (Wellfound)", "https://wellfound.com/blog/feed", "https://wellfound.com", "Startups"),
        cf("Extra Crunch", "https://extracrunch.com/feed/", "https://extracrunch.com", "Startups"),
        cf("Techstars", "https://www.techstars.com/blog/feed/", "https://www.techstars.com", "Startups"),
        cf("500 Startups", "https://500.co/feed", "https://500.co", "Startups"),

        // ===== SPORTS (10) =====
        cf("ESPN", "https://www.espn.com/espn/rss/news", "https://www.espn.com", "Sports"),
        cf("BBC Sport", "http://feeds.bbci.co.uk/sport/rss.xml", "https://www.bbc.co.uk/sport", "Sports"),
        cf("The Athletic", "https://theathletic.com/feed/", "https://theathletic.com", "Sports"),
        cf("Sky Sports", "http://feeds.skynews.com/feeds/rss/sports.xml", "https://www.skysports.com", "Sports"),
        cf("Sports Illustrated", "https://www.si.com/rss/si_topstories.xml", "https://www.si.com", "Sports"),
        cf("Bleacher Report", "https://bleacherreport.com/feed", "https://bleacherreport.com", "Sports"),
        cf("The Ringer", "https://www.theringer.com/feed", "https://www.theringer.com", "Sports"),
        cf("Deadspin", "https://deadspin.com/feed", "https://deadspin.com", "Sports"),
        cf("SB Nation", "https://www.sbnation.com/", "https://www.sbnation.com", "Sports"),
        cf("FOX Sports", "https://www.foxsports.com/feed", "https://www.foxsports.com", "Sports"),

        // ===== GAMING (11) =====
        cf("Kotaku", "https://kotaku.com/rss", "https://kotaku.com", "Gaming"),
        cf("IGN", "http://feeds.ign.com/ign/all", "https://www.ign.com", "Gaming"),
        cf("Polygon", "https://www.polygon.com/rss/index.xml", "https://www.polygon.com", "Gaming"),
        cf("Eurogamer", "https://www.eurogamer.net/?format=rss", "https://www.eurogamer.net", "Gaming"),
        cf("GameSpot", "https://www.gamespot.com/feeds/mashup/", "https://www.gamespot.com", "Gaming"),
        cf("Rock Paper Shotgun", "http://feeds.feedburner.com/RockPaperShotgun", "https://www.rockpapershotgun.com", "Gaming"),
        cf("PC Gamer", "https://www.pcgamer.com/rss/", "https://www.pcgamer.com", "Gaming"),
        cf("Kotaku Australia", "https://www.kotaku.com.au/feed", "https://www.kotaku.com.au", "Gaming"),
        cf("Nintendo Life", "https://www.nintendolife.com/feed/", "https://www.nintendolife.com", "Gaming"),
        cf("Destructoid", "https://www.destructoid.com/feed", "https://www.destructoid.com", "Gaming"),
        cf("TouchArcade", "https://toucharcade.com/community/forums/-/index.rss", "https://toucharcade.com", "Gaming"),

        // ===== ENTERTAINMENT & CULTURE (16) =====
        cf("The Onion", "https://www.theonion.com/rss", "https://www.theonion.com", "Entertainment"),
        cf("AV Club", "https://film.avclub.com/rss", "https://www.avclub.com", "Entertainment"),
        cf("Variety", "https://variety.com/feed/", "https://variety.com", "Entertainment"),
        cf("Deadline", "https://deadline.com/feed/", "https://deadline.com", "Entertainment"),
        cf("IndieWire", "https://www.indiewire.com/feed", "https://www.indiewire.com", "Entertainment"),
        cf("Rolling Stone", "https://www.rollingstone.com/feed/", "https://www.rollingstone.com", "Entertainment"),
        cf("Vulture", "https://www.vulture.com/feed", "https://www.vulture.com", "Entertainment"),
        cf("Billboard", "https://www.billboard.com/articles/rss.xml", "https://www.billboard.com", "Entertainment"),
        cf("Pitchfork", "http://pitchfork.com/rss/news", "https://pitchfork.com", "Entertainment"),
        cf("Consequence", "http://consequenceofsound.net/feed", "https://consequence.net", "Entertainment"),
        cf("NME", "https://www.nme.com/feed/nme-news.xml", "https://www.nme.com", "Entertainment"),
        cf("The Hollywood Reporter", "https://www.hollywoodreporter.com/feed", "https://www.hollywoodreporter.com", "Entertainment"),
        cf("TMZ", "https://www.tmz.com/feed/", "https://www.tmz.com", "Entertainment"),
        cf("E! Online", "https://www.eonline.com/feed/", "https://www.eonline.com", "Entertainment"),
        cf("People", "https://people.com/feed/", "https://people.com", "Entertainment"),

        // ===== DESIGN & ARCHITECTURE (12) =====
        cf("Dezeen", "https://www.dezeen.com/feed/", "https://www.dezeen.com", "Design"),
        cf("ArchDaily", "http://feeds.feedburner.com/Archdaily", "https://www.archdaily.com", "Design"),
        cf("Architectural Digest", "https://www.architecturaldigest.com/feed/rss", "https://www.architecturaldigest.com", "Design"),
        cf("Design Milk", "https://design-milk.com/feed/", "https://design-milk.com", "Design"),
        cf("Co.Design", "https://www.fastcodesign.co/feed/", "https://www.fastcodesign.co", "Design"),
        cf("Designer News", "https://www.designernews.co/?format=rss", "https://www.designernews.co", "Design"),
        cf("UX Collective", "https://uxdesign.cc/feed", "https://uxdesign.cc", "Design"),
        cf("Smashing Magazine", "https://www.smashingmagazine.com/feed", "https://www.smashingmagazine.com", "Design"),
        cf("Awwwards", "https://www.awwwwards.com/feed", "https://www.awwwwards.com", "Design"),
        cf("Dribbble Blog", "https://dribbble.com/stories/blog.xml", "https://dribbble.com", "Design"),
        cf("It's Nice That", "https://itsnicethat.com/feed", "https://itsnicethat.com", "Design"),
        cf("Logo Design Love", "https://logodesignlove.com/feed/", "https://logodesignlove.com", "Design"),

        // ===== PHOTOGRAPHY (8) =====
        cf("PetaPixel", "https://petapixel.com/feed/", "https://petapixel.com", "Photography"),
        cf("FStoppers", "https://fstoppers.com/feed", "https://fstoppers.com", "Photography"),
        cf("500px", "https://iso.500px.com/feed/", "https://500px.com", "Photography"),
        cf("Digital Photography School", "https://feeds.feedburner.com/DigitalPhotographySchool", "https://www.digital-photography-school.com", "Photography"),
        cf("Shutterbug", "https://www.shutterstock.com/blog/feed/", "https://www.shutterstock.com/blog", "Photography"),
        cf("British Journal of Photography", "https://www.bjp-online.com/feed/", "https://www.bjp-online.com", "Photography"),
        cf("Landscape Photography", "https://www.landscapephotomagazine.com/feed/", "https://www.landscapephotomagazine.com", "Photography"),
        cf("The Guardian - Camera", "https://www.theguardian.com/artanddesign/photography/rss", "https://www.theguardian.com/artanddesign/photography", "Photography"),

        // ===== FOOD & COOKING (14) =====
        cf("Serious Eats", "http://feeds.feedburner.com/seriouseats/recipes", "https://seriouseats.com", "Food"),
        cf("Bon Appetit", "https://www.bonappetit.com/feed/rss", "https://www.bonappetit.com", "Food"),
        cf("Food & Wine", "https://www.foodandwine.com/rss", "https://www.foodandwine.com", "Food"),
        cf("Epicurious", "https://www.epicurious.com/rss", "https://www.epicurious.com", "Food"),
        cf("Smitten Kitchen", "http://feeds.feedburner.com/smittenkitchen", "https://smittenkitchen.com", "Food"),
        cf("101 Cookbooks", "https://www.101cookbooks.com/feed", "https://www.101cookbooks.com", "Food"),
        cf("The Kitchn", "https://www.thekitchn.com/main.rss", "https://www.thekitchn.com", "Food"),
        cf("Saveur", "https://www.saveur.com/rss", "https://www.saveur.com", "Food"),
        cf("Tasty", "https://tasty.co/rss", "https://tasty.co", "Food"),
        cf("Delish", "https://www.delish.com/feed", "https://www.delish.com", "Food"),
        cf("America's Test Kitchen", "https://www.americastestkitchen.com/feed", "https://www.americastestkitchen.com", "Food"),
        cf("The Guardian - Food", "https://www.theguardian.com/food/rss", "https://www.theguardian.com/food", "Food"),
        cf("BBC Good Food", "https://www.bbc.co.uk/food/rss", "https://www.bbc.co.uk/food", "Food"),

        // ===== BOOKS & READING (8) =====
        cf("Book Riot", "https://bookriot.com/feed/", "https://bookriot.com", "Books"),
        cf("The New York Review of Books", "https://www.nybooks.com/feed", "https://www.nybooks.com", "Books"),
        cf("Literary Hub", "https://lithubraryhub.com/feed/", "https://lithubraryhub.com", "Books"),
        cf("Kirkus Reviews", "https://www.kirkusreviews.com/feeds/rss/", "https://www.kirkusreviews.com", "Books"),
        cf("Electric Literature", "https://electricliterature.com/feed/", "https://electricliterature.com", "Books"),
        cf("The Paris Review", "https://www.theparisreview.org/feed/rss.xml", "https://www.theparisreview.org", "Books"),
        cf("Granta", "https://granta.com/feed", "https://granta.com", "Books"),
        cf("The Millions", "https://www.themillions.com/feed/", "https://www.themillions.com", "Books"),

        // ===== TRAVEL (8) =====
        cf("Atlas Obscura", "https://www.atlasobscura.com/feeds/latest", "https://www.atlasobscura.com", "Travel"),
        cf("Lonely Planet", "https://www.lonelyplanet.com/news/feed/atom/", "https://www.lonelyplanet.com", "Travel"),
        cf("Nomadic Matt", "https://www.nomadicmatt.com/travel-blog/feed/", "https://www.nomadicmatt.com", "Travel"),
        cf("Conde Nast Traveler", "https://www.cntraveler.com/feed/", "https://www.cntraveler.com", "Travel"),
        cf("Travel + Leisure", "https://www.travelandleisure.com/feed", "https://www.travelandleisure.com", "Travel"),
        cf("The Points Guy", "https://thepointsguy.com/feed/", "https://thepointsguy.com", "Travel"),
        cf("Frommer's", "https://www.frommers.com/feeds/rss", "https://www.frommers.com", "Travel"),
        cf("Adventure.com", "https://www.adventure.com/feed", "https://www.adventure.com", "Travel"),

        // ===== FASHION & BEAUTY (8) =====
        cf("Vogue", "https://www.vogue.com/feed/rss", "https://www.vogue.com", "Fashion"),
        cf("Who What Wear", "https://www.whowhatwear.com/rss", "https://www.whowhatwear.com", "Fashion"),
        cf("Refinery29", "https://www.refinery29.com/fashion/rss.xml", "https://www.refinery29.com/fashion", "Fashion"),
        cf("Elle", "https://www.elle.com/rss/fashion.xml/", "https://www.elle.com/fashion", "Fashion"),
        cf("Harper's Bazaar", "https://www.harpersbazaar.com/feed/", "https://www.harpersbazaar.com", "Fashion"),
        cf("GQ", "https://www.gq.com/feed/rss", "https://www.gq.com", "Fashion"),
        cf("Highsnobiety", "https://www.highsnobiety.com/feed/", "https://www.highsnobiety.com", "Fashion"),
        cf("The Cut", "https://www.thecut.com/feed/", "https://www.thecut.com", "Fashion"),

        // ===== SPACE & ASTRONOMY (6) =====
        cf("Space.com", "https://www.space.com/feeds/all", "https://www.space.com", "Space"),
        cf("NASA", "https://www.nasa.gov/rss/dyn/breaking_news.rss", "https://www.nasa.gov", "Space"),
        cf("New Scientist - Space", "https://www.newscientist.com/subject/space/feed/", "https://www.newscientist.com/space", "Space"),
        cf("Sky & Telescope", "https://www.skyandtelescope.com/feed/", "https://www.skyandtelescope.com", "Space"),
        cf("Universe Today", "https://www.universetoday.com/feed/", "https://www.universetoday.com", "Space"),
        cf("Astronomy.com", "https://www.astronomy.com/feed/", "https://www.astronomy.com", "Space"),

        // ===== HUMOR (8) =====
        cf("xkcd", "https://xkcd.com/rss.xml", "https://xkcd.com", "Humor"),
        cf("The Oatmeal", "http://feeds.feedburner.com/oatmealfeed", "https://theoatmeal.com", "Humor"),
        cf("SMBC Comics", "https://www.smbc-comics.com/comic/rss", "https://www.smbc-comics.com", "Humor"),
        cf("ClickHole", "https://www.clickhole.com/rss", "https://www.clickhole.com", "Humor"),
        cf("The Onion - Satire", "https://www.theonion.com/rss", "https://www.theonion.com", "Humor"),
        cf("Funny or Die", "https://www.funnyordie.com/rss", "https://www.funnyordie.com", "Humor"),
        cf("Fail Blog", "http://feeds.feedburner.com/failblog", "https://failblog.com", "Humor"),
        cf("Cracked", "http://feeds.feedburner.com/CrackedRSS", "https://www.cracked.com", "Humor"),

        // ===== MUSIC (8) =====
        cf("Pitchfork", "http://pitchfork.com/rss/news", "https://pitchfork.com", "Music"),
        cf("Rolling Stone - Music", "https://www.rollingstone.com/music/feed/", "https://www.rollingstone.com/music", "Music"),
        cf("Billboard", "https://www.billboard.com/articles/rss.xml", "https://www.billboard.com", "Music"),
        cf("Consequence", "http://consequenceofsound.net/feed", "https://consequence.net", "Music"),
        cf("NME", "https://www.nme.com/feed/nme-news.xml", "https://www.nme.com", "Music"),
        cf("Stereogum", "https://www.stereogum.com/feed/", "https://www.stereogum.com", "Music"),
        cf("Pitchfork - Reviews", "http://pitchfork.com/rss/reviews.xml", "https://pitchfork.com/reviews", "Music"),
        cf("Resident Advisor", "https://www.residentadvisor.net/feed", "https://www.residentadvisor.net", "Music"),

        // ===== CARS (8) =====
        cf("Jalopnik", "https://jalopnik.com/rss", "https://jalopnik.com", "Cars"),
        cf("Autoblog", "https://www.autoblog.com/rss.xml", "https://www.autoblog.com", "Cars"),
        cf("Car and Driver", "https://www.caranddriver.com/rss/all.xml/", "https://www.caranddriver.com", "Cars"),
        cf("Road & Track", "https://www.roadandtrack.com/rss", "https://www.roadandtrack.com", "Cars"),
        cf("Motor Trend", "https://www.motortrend.com/rss", "https://www.motortrend.com", "Cars"),
        cf("The Verge - Cars", "https://www.theverge.com/rss/transportation.xml", "https://www.theverge.com/transportation", "Cars"),
        cf("Top Gear", "https://www.topgear.com/uk/rss.xml", "https://www.topgear.com", "Cars"),
        cf("Auto Express", "https://www.autoexpress.co.uk/feed", "https://www.autoexpress.co.uk", "Cars"),

        // ===== DIY & MAKING (6) =====
        cf("Hackaday", "https://hackaday.com/blog/feed/", "https://hackaday.com", "DIY"),
        cf("How-To Geek", "https://www.howtogeek.com/feed/", "https://www.howtogeek.com", "DIY"),
        cf("MakeUseOf", "https://www.makeuseof.com/feed/", "https://www.makeuseof.com", "DIY"),
        cf("IKEA Hackers", "https://www.ikeahackers.net/feed", "https://www.ikeahackers.net", "DIY"),
        cf("Instructables", "https://www.instructables.com/feed/", "https://www.instructables.com", "DIY"),
        cf("Wirecutter", "https://www.wirecutter.com/feed/", "https://www.wirecutter.com", "DIY"),

        // ===== HISTORY (6) =====
        cf("History Today", "https://www.historytoday.com/feed", "https://www.historytoday.com", "History"),
        cf("National Geographic", "https://www.nationalgeographic.com/feed/", "https://www.nationalgeographic.com", "History"),
        cf("Smithsonian Magazine", "https://www.smithsonianmag.com/feed/", "https://www.smithsonianmag.com", "History"),
        cf("BBC History", "https://www.bbc.co.uk/history/rss.xml", "https://www.bbc.co.uk/history", "History"),
        cf("Historical Times", "https://www.historicaltimes.com/feed", "https://www.historicaltimes.com", "History"),
        cf("Ancient History Encyclopedia", "https://www.ancient.eu/feed/", "https://www.ancient.eu", "History"),

        // ===== PERSONAL FINANCE (8) =====
        cf("NerdWallet", "https://www.nerdwallet.com/blog/feed/", "https://www.nerdwallet.com", "Personal Finance"),
        cf("The Penny Hoarder", "https://www.thepennyhoarder.com/feed/", "https://www.thepennyhoarder.com", "Personal Finance"),
        cf("MoneySaving Expert", "https://www.moneysavingexpert.com/feed/", "https://www.moneysavingexpert.com", "Personal Finance"),
        cf("The Motley Fool", "https://www.fool.com/feed/", "https://www.fool.com", "Personal Finance"),
        cf("Get Rich Slowly", "https://www.getrichslowly.org/feed/", "https://www.getrichslowly.org", "Personal Finance"),
        cf("Mr. Money Mustache", "https://www.mrmoneymustache.com/feed/", "https://www.mrmoneymustache.com", "Personal Finance"),
        cf("Millennial Money", "https://millennialmoney.com/feed/", "https://millennialmoney.com", "Personal Finance"),
        cf("Financial Samurai", "https://www.financialsamurai.com/feed/", "https://www.financialsamurai.com", "Personal Finance"),

        // ===== AI & MACHINE LEARNING (6) =====
        cf("OpenAI Blog", "https://openai.com/blog/rss/", "https://openai.com/blog", "AI"),
        cf("Google AI Blog", "https://blog.google/technology/ai/rss/", "https://blog.google/technology/ai/", "AI"),
        cf("MIT Technology Review", "https://www.technologyreview.com/feed/", "https://www.technologyreview.com", "AI"),
        cf("AI News", "https://artificialintelligence-news.com/feed/", "https://artificialintelligence-news.com", "AI"),
        cf("Machine Learning Mastery", "https://machinelearningmastery.com/feed/", "https://machinelearningmastery.com", "AI"),
        cf("The Gradient", "https://thegradient.pub/feed/", "https://thegradient.pub", "AI"),

        // ===== SECURITY (6) =====
        cf("Krebs on Security", "https://krebsonsecurity.com/feed/", "https://krebsonsecurity.com", "Security"),
        cf("Schneier on Security", "https://www.schneier.com/feed/", "https://www.schneier.com", "Security"),
        cf("BleepingComputer", "https://www.bleepingcomputer.com/feed/", "https://www.bleepingcomputer.com", "Security"),
        cf("The Hacker News", "https://feeds.feedburner.com/TheHackersNews", "https://thehackernews.com", "Security"),
        cf("Dark Reading", "https://darkreading.com/feed/", "https://darkreading.com", "Security"),
        cf("Naked Security", "https://nakedsecurity.scmp.com/feed/", "https://nakedsecurity.scmp.com", "Security"),

        // ===== CRYPTO & WEB3 (4) =====
        cf("CoinDesk", "https://www.coindesk.com/arc/outboundfeeds/rss/", "https://www.coindesk.com", "Crypto"),
        cf("CoinTelegraph", "https://cointelegraph.com/feed", "https://cointelegraph.com", "Crypto"),
        cf("Decrypt", "https://decrypt.co/feed/", "https://decrypt.co", "Crypto"),
        cf("Blockworks", "https://www.blockworks.co/feed/", "https://www.blockworks.co", "Crypto"),

        // ===== ENVIRONMENT & CLIMATE (6) =====
        cf("Grist", "https://grist.org/feed/", "https://grist.org", "Environment"),
        cf("Inside Climate News", "https://insideclimatenews.org/feed/", "https://insideclimatenews.org", "Environment"),
        cf("Climate Home", "https://www.climatechangenews.com/feed/", "https://www.climatechangenews.com", "Environment"),
        cf("Carbon Brief", "https://www.carbonbrief.org/feed/", "https://www.carbonbrief.org", "Environment"),
        cf("Yale Environment 360", "https://e360.yale.edu/feed/", "https://e360.yale.edu", "Environment"),
        cf("Earther", "https://www.earther.com/blog/feed/", "https://www.earther.com", "Environment"),

        // ===== UK (12) =====
        cf("Daily Mail", "https://www.dailymail.co.uk/home/index.rss", "https://www.dailymail.co.uk", "UK"),
        cf("The Independent", "http://www.independent.co.uk/news/uk/rss", "https://www.independent.co.uk", "UK"),
        cf("Daily Mirror", "https://www.dailymirror.co.uk/?service=rss", "https://www.dailymirror.co.uk", "UK"),
        cf("Daily Express", "http://feeds.feedburner.com/daily-express-news-showbiz", "https://www.express.co.uk", "UK"),
        cf("The Times", "https://www.thetimes.co.uk/rss/", "https://www.thetimes.co.uk", "UK"),
        cf("Financial Times UK", "https://www.ft.com/rss/home", "https://www.ft.com", "UK"),
        cf("The Telegraph", "https://www.telegraph.co.uk/news/rss.xml", "https://www.telegraph.co.uk", "UK"),
        cf("BBC News UK", "http://feeds.bbci.co.uk/news/rss.xml", "https://www.bbc.co.uk/news", "UK"),
        cf("ITV News", "https://www.itv.com/news/rss.xml", "https://www.itv.com/news", "UK"),
        cf("Sky News UK", "https://news.sky.com/rss", "https://news.sky.com", "UK"),
        cf("Metro UK", "https://metro.co.uk/feed/", "https://metro.co.uk", "UK"),

        // ===== INDIA (14) =====
        cf("Times of India", "https://timesofindia.indiatimes.com/rssfeedstopstories.cms", "https://timesofindia.indiatimes.com", "India"),
        cf("The Hindu", "https://www.thehindu.com/feeder/default.rss", "https://www.thehindu.com", "India"),
        cf("NDTV", "https://feeds.feedburner.com/ndtvnews-top-stories", "https://www.ndtv.com", "India"),
        cf("India Today", "https://www.indiatoday.in/rss/home", "https://www.indiatoday.in", "India"),
        cf("Economic Times", "https://economictimes.indiatimes.com/rssfeedsdefault.cms", "https://economictimes.indiatimes.com", "India"),
        cf("Indian Express", "http://indianexpress.com/print/front-page/feed/", "https://indianexpress.com", "India"),
        cf("Firstpost", "https://www.firstpost.com/rss/india.xml", "https://www.firstpost.com", "India"),
        cf("The Quint", "https://thequint.com/feed/", "https://thequint.com", "India"),
        cf("Scroll.in", "http://feeds.feedburner.com/ScrollinArticles.rss", "https://scroll.in", "India"),
        cf("Moneycontrol", "http://www.moneycontrol.com/rss/latestnews.xml", "https://www.moneycontrol.com", "India"),
        cf("Business Standard", "https://www.business-standard.com/rss/home_page_top_stories.rss", "https://www.business-standard.com", "India"),
        cf("Hindustan Times", "https://www.hindustantimes.com/feed/", "https://www.hindustantimes.com", "India"),

        // ===== US (12) =====
        cf("LA Times", "https://www.latimes.com/world-nation/rss2.0.xml", "https://www.latimes.com", "US"),
        cf("Chicago Tribune", "https://www.chicagotribune.com/feed/", "https://www.chicagotribune.com", "US"),
        cf("USA Today", "https://rss.usatoday.com/usatodaycomNews-topStories", "https://www.usatoday.com", "US"),
        cf("Boston Globe", "https://www.bostonglobe.com/rss/", "https://www.bostonglobe.com", "US"),
        cf("San Francisco Chronicle", "https://www.sfgate.com/feed/", "https://www.sfgate.com", "US"),
        cf("Dallas Morning News", "https://www.dallasnews.com/feed/", "https://www.dallasnews.com", "US"),
        cf("Philadelphia Inquirer", "https://www.inquirer.com/feed/", "https://www.inquirer.com", "US"),
        cf("Miami Herald", "https://www.miamiherald.com/feed/", "https://www.miamiherald.com", "US"),
        cf("Arizona Republic", "https://www.azcentral.com/feed/", "https://www.azcentral.com", "US"),

        // ===== CANADA (8) =====
        cf("CBC News", "https://www.cbc.ca/cmlink/rss-topstories", "https://www.cbc.ca/news", "Canada"),
        cf("CTV News", "https://www.ctvnews.ca/rss/ctvnews-ca-top-stories-public-rss-1.822009", "https://www.ctvnews.ca", "Canada"),
        cf("Global News", "https://globalnews.ca/feed/", "https://globalnews.ca", "Canada"),
        cf("Toronto Star", "https://www.thestar.com/content/thestar/feed.RSSManagerServlet.articles.topstories.rss", "https://www.thestar.com", "Canada"),
        cf("National Post", "https://nationalpost.com/feed", "https://nationalpost.com", "Canada"),
        cf("Maclean's", "https://www.macleans.ca/feed/", "https://www.macleans.ca", "Canada"),
        cf("Vancouver Sun", "https://vancouversun.com/feed/", "https://vancouversun.com", "Canada"),
        cf("Globe and Mail", "https://www.theglobeandmail.com/feed/", "https://www.theglobeandmail.com", "Canada"),

        // ===== AUSTRALIA (10) =====
        cf("ABC News Australia", "https://www.abc.net.au/news/feed/1948/rss.xml", "https://www.abc.net.au/news", "Australia"),
        cf("Sydney Morning Herald", "https://www.smh.com.au/rss/feed.xml", "https://www.smh.com.au", "Australia"),
        cf("The Age", "https://www.theage.com.au/rss/feed.xml", "https://www.theage.com.au", "Australia"),
        cf("The Australian", "https://www.theaustralian.com.au/rss/", "https://www.theaustralian.com.au", "Australia"),
        cf("The Guardian Australia", "https://www.theguardian.com/au/rss", "https://www.theguardian.com/au", "Australia"),
        cf(" news.com.au", "https://www.news.com.au/feed/", "https://www.news.com.au", "Australia"),
        cf("Crikey", "https://feeds.feedburner.com/com/rCTl", "https://www.crikey.com.au", "Australia"),
        cf("The Conversation", "https://theconversation.com/au/feed/", "https://theconversation.com/au", "Australia"),

        // ===== GERMANY (8) =====
        cf("ZEIT ONLINE", "http://newsfeed.zeit.de/index", "https://www.zeit.de", "Germany"),
        cf("FAZ", "https://www.faz.net/rss/aktuell/", "https://www.faz.net", "Germany"),
        cf("Tagesschau", "http://www.tagesschau.de/xml/rss2", "https://www.tagesschau.de", "Germany"),
        cf("Deutsche Welle", "https://rss.dw.com/rdf/rss-en-all", "https://www.dw.com", "Germany"),
        cf("FOCUS Online", "https://rss.focus.de/fol/XML/rss_folnews.xml", "https://www.focus.de", "Germany"),
        cf("Der Spiegel", "https://www.spiegel.de/rss/", "https://www.spiegel.de", "Germany"),
        cf("Handelsblatt", "https://www.handelsblatt.com/feed/", "https://www.handelsblatt.com", "Germany"),
        cf("Manager Magazin", "https://www.manager-magazin.de/feed/", "https://www.manager-magazin.de", "Germany"),

        // ===== FRANCE (8) =====
        cf("Le Monde", "https://www.lemonde.fr/rss/une.xml", "https://www.lemonde.fr", "France"),
        cf("Le Figaro", "https://www.lefigaro.fr/rss/figaro_actualites.xml", "https://www.lefigaro.fr", "France"),
        cf("France 24", "https://www.france24.com/en/rss", "https://www.france24.com", "France"),
        cf("Les Echos", "https://www.lesechos.fr/rss/rss.xml", "https://www.lesechos.fr", "France"),
        cf("Mediapart", "https://www.mediapart.fr/articles/feed", "https://www.mediapart.fr", "France"),
        cf("L'Obs", "https://www.nouvelobs.com/a-la-une/rss.xml", "https://www.nouvelobs.com", "France"),
        cf("France Info", "https://www.francetvinfo.fr/titres.rss", "https://www.francetvinfo.fr", "France"),
        cf("Libération", "https://www.liberation.fr/rss/", "https://www.liberation.fr", "France"),

        // ===== SPAIN (6) =====
        cf("El Pais", "https://feeds.elpais.com/mrss-s/pages/ep/site/elpais.com/portada", "https://elpais.com", "Spain"),
        cf("El Mundo", "https://elmundo.es/rss", "https://elmundo.es", "Spain"),
        cf("El Confidencial", "https://rss.elconfidencial.com/espana/", "https://elconfidencial.com", "Spain"),
        cf("El Diario", "https://www.eldiario.es/rss/", "https://www.eldiario.es", "Spain"),
        cf("La Vanguardia", "https://www.lavanguardia.com/rss/", "https://www.lavanguardia.com", "Spain"),
        cf("El Periodico", "https://www.elperiodico.com/es/rss/rss_portada.xml", "https://www.elperiodico.com", "Spain"),

        // ===== ITALY (10) =====
        cf("ANSA", "https://www.ansa.it/sito/ansait_rss.xml", "https://www.ansa.it", "Italy"),
        cf("Il Post", "https://www.ilpost.it/feed/", "https://www.ilpost.it", "Italy"),
        cf("La Repubblica", "https://www.repubblica.it/rss/homepage/rss2.0.xml", "https://www.repubblica.it", "Italy"),
        cf("Corriere della Sera", "https://www.corrieredellasera.it/feed/", "https://www.corrieredellasera.it", "Italy"),
        cf("Il Fatto Quotidiano", "https://www.ilfattoquotidiano.it/rss.xml", "https://www.ilfattoquotidiano.it", "Italy"),
        cf("La Stampa", "https://www.lastampa.it/feed/", "https://www.lastampa.it", "Italy"),
        cf("Panorama", "https://www.panorama.it/feeds/feed.rss", "https://www.panorama.it", "Italy"),
        cf("Internazionale", "https://www.internazionale.it/sitemaps/rss.xml", "https://www.internazionale.it", "Italy"),
        cf("Fanpage.it", "https://www.fanpage.it/feed/", "https://www.fanpage.it", "Italy"),

        // ===== JAPAN (8) =====
        cf("Japan Times", "https://www.japantimes.co.jp/feed/topstories/", "https://www.japantimes.co.jp", "Japan"),
        cf("Japan Today", "https://japantoday.com/feed", "https://japantoday.com", "Japan"),
        cf("NHK News Web", "https://www3.nhk.or.jp/nhkworld/en/news/rss.xml", "https://www3.nhk.or.jp/nhkworld", "Japan"),
        cf("Asahi Shimbun", "http://rss.asahi.com/rss/asahi/newsheadlines.rdf", "https://www.asahi.com", "Japan"),
        cf("Mainichi Shimbun", "https://mainichi.jp/feed/", "https://mainichi.jp", "Japan"),
        cf("Yomiuri Shimbun", "https://www.yomiuri.co.jp/feed/", "https://www.yomiuri.co.jp", "Japan"),
        cf("Nikkei Asia", "https://asia.nikkei.com/feed/", "https://asia.nikkei.com", "Japan"),
        cf("Kyodo News", "https://english.kyodonews.net/rss/all.xml", "https://english.kyodonews.net", "Japan"),

        // ===== BRAZIL (6) =====
        cf("Folha de S.Paulo", "https://feeds.folha.uol.com.br/emcimadahora/rss091.xml", "https://www.folha.uol.com.br", "Brazil"),
        cf("O Globo", "https://oglo.globo.com/rss/", "https://oglo.globo.com", "Brazil"),
        cf("O Estado de S. Paulo", "https://www.estadao.com.br/feed/", "https://www.estadao.com.br", "Brazil"),
        cf("Folha", "https://www.folha.uol.com.br/feed/", "https://www.folha.uol.com.br", "Brazil"),
        cf("Veja", "https://veja.abril.com.br/rss/", "https://veja.abril.com.br", "Brazil"),
        cf("IG", "https://ig.com.br/rss/", "https://ig.com.br", "Brazil"),

        // ===== MEXICO (8) =====
        cf("El Universal", "https://www.eluniversal.com.mx/seccion/1671/rss.xml", "https://www.eluniversal.com.mx", "Mexico"),
        cf("Excelsior", "https://www.excelsior.com.mx/rss.xml", "https://www.excelsior.com.mx", "Mexico"),
        cf("Reforma", "https://www.reforma.com/rss/portada.xml", "https://www.reforma.com.mx", "Mexico"),
        cf("Proceso", "https://www.elproceso.com.mx/rss/", "https://www.elproceso.com.mx", "Mexico"),
        cf("La Jornada", "https://www.lajornada.com.mx/feed/", "https://www.lajornada.com.mx", "Mexico"),
        cf("El Financiero", "https://www.elfinanciero.com.mx/arc/outboundfeeds/rss/?outputType=xml", "https://www.elfinanciero.com.mx", "Mexico"),
        cf("Milenio", "https://www.milenio.com.mx/feed/", "https://www.milenio.com.mx", "Mexico"),
        cf("Cronica de Hoy", "https://www.cronicodehoy.com.mx/rss/feed.xml", "https://www.cronicodehoy.com.mx", "Mexico"),

        // ===== RUSSIA (8) =====
        cf("Meduza", "https://meduza.io/rss/all", "https://meduza.io", "Russia"),
        cf("The Moscow Times", "https://www.themoscowtimes.com/rss/news", "https://www.themoscowtimes.com", "Russia"),
        cf("RBK", "https://www.rbc.ru/rss/", "https://www.rbc.ru", "Russia"),
        cf("TASS", "http://tass.com/rss/v2.xml", "https://tass.com", "Russia"),
        cf("Lenta.ru", "https://lenta.ru/rss", "https://lenta.ru", "Russia"),
        cf("Kommersant", "https://www.kommersant.ru/RSS/main.xml", "https://www.kommersant.ru", "Russia"),
        cf("Izvestia", "https://iz.ru/rss/", "https://iz.ru", "Russia"),
        cf("Novaya Gazeta", "https://novayagazeta.ru/rss/", "https://novayagazeta.ru", "Russia"),

        // ===== UKRAINE (6) =====
        cf("Ukrayinska Pravda", "https://www.pravda.com.ua/rss/", "https://www.pravda.com.ua", "Ukraine"),
        cf("UNIAN", "https://rss.unian.net/site/news_eng.rss", "https://unian.net", "Ukraine"),
        cf("NV", "https://nv.ua/rss/all.xml", "https://nv.ua", "Ukraine"),
        cf("Ukrinform", "https://www.ukrinform.net.ua/feed/", "https://www.ukrinform.net.ua", "Ukraine"),
        cf("Kyiv Independent", "https://kyivindependent.com/feed/", "https://kyivindependent.com", "Ukraine"),
        cf("The Gaze", "https://thegaze.post/rss/", "https://thegaze.post", "Ukraine"),

        // ===== SOUTH AFRICA (8) =====
        cf("News24", "http://feeds.news24.com/articles/news24/TopStories/rss", "https://www.news24.com", "South Africa"),
        cf("Daily Maverick", "https://www.dailymaverick.co.za/dmrss/", "https://www.dailymaverick.co.za", "South Africa"),
        cf("TimesLIVE", "https://www.timeslive.co.za/rss/", "https://www.timeslive.co.za", "South Africa"),
        cf("BusinessTech", "https://businesstech.co.za/news/feed/", "https://businesstech.co.za", "South Africa"),
        cf("Mail & Guardian", "https://mg.co.za/feed/", "https://mg.co.za", "South Africa"),
        cf("SowetanLIVE", "https://www.sowetanlive.co.za/rss/?publication=sowetan-live", "https://www.sowetanlive.co.za", "South Africa"),
        cf("City Press", "https://www.pressreader.com/feed/", "https://www.pressreader.com", "South Africa"),
        cf("The Star", "https://www.thestar.co.za/feed/", "https://www.thestar.co.za", "South Africa"),

        // ===== NIGERIA (6) =====
        cf("Premium Times", "https://www.premiumtimesng.com/feed", "https://www.premiumtimesng.com", "Nigeria"),
        cf("Daily Post", "https://dailypost.ng/feed", "https://dailypost.ng", "Nigeria"),
        cf("The Guardian Nigeria", "https://guardian.ng/feed/", "https://guardian.ng", "Nigeria"),
        cf("This Day Live", "https://www.thisdaylive.com/feed/", "https://www.thisdaylive.com", "Nigeria"),
        cf("Punch Nigeria", "https://punchng.com/feed/", "https://punchng.com", "Nigeria"),
        cf("Vanguard", "https://www.vanguardngr.com/feed/", "https://www.vanguardngr.com", "Nigeria"),
        cf("Sahara Reporters", "http://saharareporters.com/feeds/latest/feed", "https://saharareporters.com", "Nigeria"),

        // ===== PHILIPPINES (8) =====
        cf("INQUIRER.net", "https://www.inquirer.net/fullfeed", "https://www.inquirer.net", "Philippines"),
        cf("Philippine Star", "https://www.philstar.com/rss/headlines", "https://www.philstar.com", "Philippines"),
        cf("ABS-CBN News", "https://data.gmanews.tv/gno/rss/news/feed.xml", "https://www.gmanews.tv", "Philippines"),
        cf("Rappler", "https://www.rappler.com/feed/", "https://www.rappler.com", "Philippines"),
        cf("Manila Bulletin", "https://www.manilatimes.net/feed/", "https://www.manilatimes.net", "Philippines"),
        cf("BusinessWorld", "https://www.bworldonline.com/feed/", "https://www.bworldonline.com", "Philippines"),
        cf("Philippine Daily Inquirer", "https://www.dailytribune.net.ph/feed/", "https://www.dailytribune.net.ph", "Philippines"),

        // ===== PAKISTAN (6) =====
        cf("The Express Tribune", "https://tribune.com.pk/feed/home", "https://tribune.com.pk", "Pakistan"),
        cf("Dawn News", "https://www.dawn.com/feed/", "https://www.dawn.com", "Pakistan"),
        cf("The Nation", "https://nation.com.pk/rss/top-stories", "https://nation.com.pk", "Pakistan"),
        cf("Geo News", "https://www.geo.tv/feed/", "https://www.geo.tv", "Pakistan"),
        cf("ARY News", "https://www.arynews.tv/feed/", "https://www.arynews.tv", "Pakistan"),
        cf("Bol News", "https://www.bolnews.com/feed/", "https://www.bolnews.com", "Pakistan"),

        // ===== POLAND (6) =====
        cf("RMF24", "https://www.rmf24.pl/feed", "https://www.rmf24.pl", "Poland"),
        cf("Gazeta Wyborcza", "https://www.gazetaprawy.pl/rss.xml", "https://www.gazetaprawy.pl", "Poland"),
        cf("Gazeta Prawna", "https://www.gazeta.pl/rss.xml", "https://www.gazeta.pl", "Poland"),
        cf("Polityka", "https://www.polityka.pl/rss/1/1", "https://www.polityka.pl", "Poland"),
        cf("Newsweek Polska", "https://www.newsweek.pl/rss.xml", "https://www.newsweek.pl", "Poland"),
        cf("Wirtualne Media", "https://www.wirtualnemedia.pl/rss/wirtualnemedia_rss.xml", "https://www.wirtualnemedia.pl", "Poland"),

        // ===== HONG KONG (4) =====
        cf("South China Morning Post", "https://www.scmp.com/rss/91/feed", "https://www.scmp.com", "Hong Kong"),
        cf("Hong Kong Free Press", "https://www.hongkongfp.com/feed/", "https://www.hongkongfp.com", "Hong Kong"),
        cf("The Standard", "https://www.thestandard.com.hk/newsfeed/latest/news.xml", "https://www.thestandard.com.hk", "Hong Kong"),
        cf("Hong Kong Economic Journal", "https://www.hkej.com/rss/hongkong", "https://www.hkej.com", "Hong Kong"),

        // ===== INDONESIA (6) =====
        cf("Kompas", "https://www.kompas.com/rss/", "https://www.kompas.com", "Indonesia"),
        cf("Republika", "https://www.republika.co.id/rss/", "https://www.republika.co.id", "Indonesia"),
        cf("Tempo", "https://www.tempo.co/feed/", "https://www.tempo.co", "Indonesia"),
        cf("Jakarta Post", "https://jakartapost.net/feed/", "https://jakartapost.net", "Indonesia"),
        cf("Bisnis Indonesia", "https://www.bisnis.com/feed/", "https://www.bisnis.com", "Indonesia"),
        cf("Detik.com", "https://www.detik.com/feed/", "https://www.detik.com", "Indonesia"),

        // ===== IRAN (4) =====
        cf("Iran Front Page", "https://ifpnews.com/feed/", "https://ifpnews.com", "Iran"),
        cf("Tasnim", "https://www.tasnimnews.com/fa/rss/feed/0/8/0/%D9%85%D9%85%D8%AA%D8%AA-%D8%B3%D9%87%D8%AA%D9%85%D8%AA", "https://www.tasnimnews.com", "Iran"),
        cf("ISNA", "https://www.isna.ir/rss", "https://www.isna.ir", "Iran"),
        cf("Tabnak", "https://www.tabnak.ir/fa/rss/allnews", "https://www.tabnak.ir", "Iran"),

        // ===== IRELAND (4) =====
        cf("TheJournal.ie", "https://www.thejournal.ie/feed/", "https://www.thejournal.ie", "Ireland"),
        cf("Irish Independent", "https://www.independent.ie/rss/", "https://www.independent.ie", "Ireland"),
        cf("BreakingNews.ie", "https://feeds.breakingnews.ie/bntopstories", "https://www.breakingnews.ie", "Ireland"),
        cf("Irish Times", "https://www.irishtimes.com/rss/", "https://www.irishtimes.com", "Ireland"),

        // ===== UAE / MIDDLE EAST (4) =====
        cf("Gulf News", "https://gulfnews.com/feed/", "https://gulfnews.com", "Middle East"),
        cf("Al Jazeera English", "https://www.aljazeera.com/english/rss", "https://www.aljazeera.com/english", "Middle East"),
        cf("Middle East Eye", "https://www.middleeasteye.net/feed/", "https://www.middleeasteye.net", "Middle East"),
        cf("Arab News", "https://www.arabnews.com/rss/", "https://www.arabnews.com", "Middle East"),

        // ===== NEW ZEALAND (4) =====
        cf("Stuff.co.nz", "https://www.stuff.co.nz/feed/", "https://www.stuff.co.nz", "New Zealand"),
        cf("New Zealand Herald", "https://www.nzherald.co.nz/feed/", "https://www.nzherald.co.nz", "New Zealand"),
        cf("Newstalk", "https://www.newstalk.co.nz/feed/", "https://www.newstalk.co.nz", "New Zealand"),
        cf("The Spinoff", "https://thespinoff.co.nz/feed/", "https://thespinoff.co.nz", "New Zealand"),
    ];

    feeds.extend(load_generated_feedspot_feeds());

    let mut seen = HashSet::new();
    feeds.retain(|feed| {
        let key = (
            feed.feed_url.trim().to_lowercase(),
            feed.site_url.trim().to_lowercase(),
        );
        seen.insert(key)
    });

    feeds
}

/// Shorthand for creating CuratedFeed entries
fn cf(title: &'static str, feed_url: &'static str, site_url: &'static str, category: &'static str) -> CuratedFeed {
    CuratedFeed {
        title: title.to_string(),
        feed_url: feed_url.to_string(),
        site_url: site_url.to_string(),
        category: category.to_string(),
    }
}

fn load_generated_feedspot_feeds() -> Vec<CuratedFeed> {
    const GENERATED_FEEDS_JSON: &str = include_str!("generated/feedspot_curated_feeds.json");
    serde_json::from_str(GENERATED_FEEDS_JSON).unwrap_or_default()
}
