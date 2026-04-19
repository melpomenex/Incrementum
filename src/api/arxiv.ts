/**
 * ArXiv paper import functionality
 */

import { fetchUrlContent, readDocumentFile } from "./documents";

/**
 * ArXiv category within a domain
 */
export interface ArxivCategory {
  id: string;
  name: string;
}

/**
 * ArXiv top-level domain group
 */
export interface ArxivDomain {
  id: string;
  name: string;
  categories: ArxivCategory[];
}

/**
 * ArXiv paper metadata
 */
export interface ArxivPaper {
  id: string;
  title: string;
  authors: string[];
  summary: string;
  published: string;
  updated: string;
  pdfUrl: string;
  absUrl: string;
  categories: string[];
  comment?: string;
  journalRef?: string;
  doi?: string;
  primaryCategory: string;
}

/**
 * ArXiv API namespace
 */
const ARXIV_API = "https://export.arxiv.org/api/query";

/**
 * Helper to fetch XML content with CORS proxy support
 */
async function fetchXmlWithCors(url: string): Promise<string> {
  try {
    // Use backend fetchUrlContent to handle CORS via proxies
    // This works in both Tauri (direct) and Browser (proxies)
    const fetched = await fetchUrlContent(url);
    const base64Content = await readDocumentFile(fetched.file_path);
    return atob(base64Content);
  } catch (error) {
    console.error("Failed to fetch ArXiv data:", error);
    throw new Error(`Failed to fetch ArXiv data: ${error instanceof Error ? error.message : String(error)}`);
  }
}

/**
 * Search ArXiv for papers
 */
export async function searchArxiv(
  query: string,
  maxResults: number = 10
): Promise<ArxivPaper[]> {
  try {
    const searchQuery = `all:${query}`;
    const url = `${ARXIV_API}?search_query=${encodeURIComponent(
      searchQuery
    )}&start=0&max_results=${maxResults}`;

    const xmlText = await fetchXmlWithCors(url);
    return parseArxivResponse(xmlText);
  } catch (error) {
    console.error("Failed to search ArXiv:", error);
    return [];
  }
}

/**
 * Get paper by ID
 */
export async function getArxivPaper(paperId: string): Promise<ArxivPaper | null> {
  try {
    const url = `${ARXIV_API}?id_list=${encodeURIComponent(paperId)}`;
    const xmlText = await fetchXmlWithCors(url);
    const papers = parseArxivResponse(xmlText);
    return papers[0] || null;
  } catch (error) {
    console.error("Failed to fetch ArXiv paper:", error);
    return null;
  }
}

/**
 * Get recent papers from a category
 */
export async function getArxivCategoryPapers(
  category: string,
  maxResults: number = 20
): Promise<ArxivPaper[]> {
  try {
    const url = `${ARXIV_API}?search_query=cat:${encodeURIComponent(
      category
    )}&start=0&max_results=${maxResults}&sortBy=submittedDate&sortOrder=descending`;

    const xmlText = await fetchXmlWithCors(url);
    return parseArxivResponse(xmlText);
  } catch (error) {
    console.error("Failed to fetch ArXiv category papers:", error);
    return [];
  }
}

/**
 * Parse ArXiv API XML response
 */
function parseArxivResponse(xmlText: string): ArxivPaper[] {
  const parser = new DOMParser();
  const xmlDoc = parser.parseFromString(xmlText, "text/xml");

  const entries = xmlDoc.querySelectorAll("entry");
  const papers: ArxivPaper[] = [];

  entries.forEach((entry) => {
    // Extract ID from the arxiv URL, stripping version suffix (e.g., 2301.07041v1 -> 2301.07041)
    const idUrl = entry.querySelector("id")?.textContent || "";
    const id = idUrl.replace(/v\d+$/, "").split("/").pop() || "";
    const title = entry.querySelector("title")?.textContent?.trim() || "";
    const summary = entry.querySelector("summary")?.textContent?.trim() || "";
    const published = entry.querySelector("published")?.textContent || "";
    const updated = entry.querySelector("updated")?.textContent || "";

    // Authors
    const authors: string[] = [];
    entry.querySelectorAll("author name").forEach((name) => {
      if (name.textContent) {
        authors.push(name.textContent);
      }
    });

    // Categories
    const categories: string[] = [];
    const primaryCategory =
      entry.querySelector("primary_category")?.getAttribute("term") || "";
    entry.querySelectorAll("category").forEach((cat) => {
      const term = cat.getAttribute("term");
      if (term) {
        categories.push(term);
      }
    });

    // Links
    const pdfLink = entry.querySelector(`link[title="pdf"]`);
    const pdfUrl = pdfLink?.getAttribute("href") || "";
    const absLink = entry.querySelector("link");
    const absUrl = absLink?.getAttribute("href") || "";

    // Optional fields
    const comment = entry.querySelector("comment")?.textContent;
    const journalRef = entry.querySelector("journal_ref")?.textContent;
    const doi = entry.querySelector("doi")?.textContent;

    papers.push({
      id,
      title,
      authors,
      summary,
      published,
      updated,
      pdfUrl,
      absUrl,
      categories,
      comment,
      journalRef,
      doi,
      primaryCategory,
    });
  });

  return papers;
}

/**
 * Get ArXiv category display name
 */
export function getCategoryDisplayName(category: string): string {
  return CATEGORY_DISPLAY_NAMES[category] || category;
}

/**
 * Complete ArXiv category taxonomy grouped by domain.
 * Single source of truth for all category data.
 */
export const ARXIV_DOMAINS: ArxivDomain[] = [
  {
    id: "cs",
    name: "Computer Science",
    categories: [
      { id: "cs.AI", name: "Artificial Intelligence" },
      { id: "cs.AR", name: "Hardware Architecture" },
      { id: "cs.CC", name: "Computational Complexity" },
      { id: "cs.CE", name: "Computational Engineering, Finance, and Science" },
      { id: "cs.CG", name: "Computational Geometry" },
      { id: "cs.CL", name: "Computation and Language" },
      { id: "cs.CR", name: "Cryptography and Security" },
      { id: "cs.CV", name: "Computer Vision and Pattern Recognition" },
      { id: "cs.CY", name: "Computers and Society" },
      { id: "cs.DB", name: "Databases" },
      { id: "cs.DC", name: "Distributed, Parallel, and Cluster Computing" },
      { id: "cs.DL", name: "Digital Libraries" },
      { id: "cs.DM", name: "Discrete Mathematics" },
      { id: "cs.DS", name: "Data Structures and Algorithms" },
      { id: "cs.ET", name: "Emerging Technologies" },
      { id: "cs.FL", name: "Formal Languages and Automata Theory" },
      { id: "cs.GL", name: "General Literature" },
      { id: "cs.GR", name: "Graphics" },
      { id: "cs.GT", name: "Computer Science and Game Theory" },
      { id: "cs.HC", name: "Human-Computer Interaction" },
      { id: "cs.IR", name: "Information Retrieval" },
      { id: "cs.IT", name: "Information Theory" },
      { id: "cs.LG", name: "Machine Learning" },
      { id: "cs.LO", name: "Logic in Computer Science" },
      { id: "cs.MA", name: "Multiagent Systems" },
      { id: "cs.MM", name: "Multimedia" },
      { id: "cs.MS", name: "Mathematical Software" },
      { id: "cs.NA", name: "Numerical Analysis" },
      { id: "cs.NE", name: "Neural and Evolutionary Computing" },
      { id: "cs.NI", name: "Networking and Internet Architecture" },
      { id: "cs.OH", name: "Other Computer Science" },
      { id: "cs.OS", name: "Operating Systems" },
      { id: "cs.PF", name: "Performance" },
      { id: "cs.PL", name: "Programming Languages" },
      { id: "cs.RO", name: "Robotics" },
      { id: "cs.SC", name: "Symbolic Computation" },
      { id: "cs.SD", name: "Sound" },
      { id: "cs.SE", name: "Software Engineering" },
      { id: "cs.SI", name: "Social and Information Networks" },
      { id: "cs.SY", name: "Systems and Control" },
    ],
  },
  {
    id: "econ",
    name: "Economics",
    categories: [
      { id: "econ.EM", name: "Econometrics" },
      { id: "econ.GN", name: "General Economics" },
      { id: "econ.TH", name: "Theoretical Economics" },
    ],
  },
  {
    id: "eess",
    name: "Electrical Engineering and Systems Science",
    categories: [
      { id: "eess.AS", name: "Audio and Speech Processing" },
      { id: "eess.IV", name: "Image and Video Processing" },
      { id: "eess.SP", name: "Signal Processing" },
      { id: "eess.SY", name: "Systems and Control" },
    ],
  },
  {
    id: "math",
    name: "Mathematics",
    categories: [
      { id: "math.AC", name: "Commutative Algebra" },
      { id: "math.AG", name: "Algebraic Geometry" },
      { id: "math.AP", name: "Analysis of PDEs" },
      { id: "math.AT", name: "Algebraic Topology" },
      { id: "math.CA", name: "Classical Analysis and ODEs" },
      { id: "math.CO", name: "Combinatorics" },
      { id: "math.CT", name: "Category Theory" },
      { id: "math.CV", name: "Complex Variables" },
      { id: "math.DG", name: "Differential Geometry" },
      { id: "math.DS", name: "Dynamical Systems" },
      { id: "math.FA", name: "Functional Analysis" },
      { id: "math.GM", name: "General Mathematics" },
      { id: "math.GN", name: "General Topology" },
      { id: "math.GR", name: "Group Theory" },
      { id: "math.GT", name: "Geometric Topology" },
      { id: "math.HO", name: "History and Overview" },
      { id: "math.IT", name: "Information Theory" },
      { id: "math.KT", name: "K-Theory and Homology" },
      { id: "math.LO", name: "Logic" },
      { id: "math.MG", name: "Metric Geometry" },
      { id: "math.MP", name: "Mathematical Physics" },
      { id: "math.NA", name: "Numerical Analysis" },
      { id: "math.NT", name: "Number Theory" },
      { id: "math.OA", name: "Operator Algebras" },
      { id: "math.OC", name: "Optimization and Control" },
      { id: "math.PR", name: "Probability" },
      { id: "math.QA", name: "Quantum Algebra" },
      { id: "math.RA", name: "Rings and Algebras" },
      { id: "math.RT", name: "Representation Theory" },
      { id: "math.SG", name: "Symplectic Geometry" },
      { id: "math.SP", name: "Spectral Theory" },
      { id: "math.ST", name: "Statistics Theory" },
    ],
  },
  {
    id: "astro-ph",
    name: "Astrophysics",
    categories: [
      { id: "astro-ph.CO", name: "Cosmology and Nongalactic Astrophysics" },
      { id: "astro-ph.EP", name: "Earth and Planetary Astrophysics" },
      { id: "astro-ph.GA", name: "Astrophysics of Galaxies" },
      { id: "astro-ph.HE", name: "High Energy Astrophysical Phenomena" },
      { id: "astro-ph.IM", name: "Instrumentation and Methods for Astrophysics" },
      { id: "astro-ph.SR", name: "Solar and Stellar Astrophysics" },
    ],
  },
  {
    id: "cond-mat",
    name: "Condensed Matter",
    categories: [
      { id: "cond-mat.dis-nn", name: "Disordered Systems and Neural Networks" },
      { id: "cond-mat.mes-hall", name: "Mesoscale and Nanoscale Physics" },
      { id: "cond-mat.mtrl-sci", name: "Materials Science" },
      { id: "cond-mat.other", name: "Other Condensed Matter" },
      { id: "cond-mat.quant-gas", name: "Quantum Gases" },
      { id: "cond-mat.soft", name: "Soft Condensed Matter" },
      { id: "cond-mat.stat-mech", name: "Statistical Mechanics" },
      { id: "cond-mat.str-el", name: "Strongly Correlated Electrons" },
      { id: "cond-mat.supr-con", name: "Superconductivity" },
    ],
  },
  {
    id: "gr-qc",
    name: "General Relativity and Quantum Cosmology",
    categories: [
      { id: "gr-qc", name: "General Relativity and Quantum Cosmology" },
    ],
  },
  {
    id: "hep-ex",
    name: "High Energy Physics - Experiment",
    categories: [
      { id: "hep-ex", name: "High Energy Physics - Experiment" },
    ],
  },
  {
    id: "hep-lat",
    name: "High Energy Physics - Lattice",
    categories: [
      { id: "hep-lat", name: "High Energy Physics - Lattice" },
    ],
  },
  {
    id: "hep-ph",
    name: "High Energy Physics - Phenomenology",
    categories: [
      { id: "hep-ph", name: "High Energy Physics - Phenomenology" },
    ],
  },
  {
    id: "hep-th",
    name: "High Energy Physics - Theory",
    categories: [
      { id: "hep-th", name: "High Energy Physics - Theory" },
    ],
  },
  {
    id: "math-ph",
    name: "Mathematical Physics",
    categories: [
      { id: "math-ph", name: "Mathematical Physics" },
    ],
  },
  {
    id: "nlin",
    name: "Nonlinear Sciences",
    categories: [
      { id: "nlin.AO", name: "Adaptation and Self-Organizing Systems" },
      { id: "nlin.CD", name: "Chaotic Dynamics" },
      { id: "nlin.CG", name: "Cellular Automata and Lattice Gases" },
      { id: "nlin.PS", name: "Pattern Formation and Solitons" },
      { id: "nlin.SI", name: "Exactly Solvable and Integrable Systems" },
    ],
  },
  {
    id: "nucl-ex",
    name: "Nuclear Experiment",
    categories: [
      { id: "nucl-ex", name: "Nuclear Experiment" },
    ],
  },
  {
    id: "nucl-th",
    name: "Nuclear Theory",
    categories: [
      { id: "nucl-th", name: "Nuclear Theory" },
    ],
  },
  {
    id: "physics",
    name: "Physics",
    categories: [
      { id: "physics.acc-ph", name: "Accelerator Physics" },
      { id: "physics.ao-ph", name: "Atmospheric and Oceanic Physics" },
      { id: "physics.app-ph", name: "Applied Physics" },
      { id: "physics.atm-clus", name: "Atomic and Molecular Clusters" },
      { id: "physics.atom-ph", name: "Atomic Physics" },
      { id: "physics.bio-ph", name: "Biological Physics" },
      { id: "physics.chem-ph", name: "Chemical Physics" },
      { id: "physics.class-ph", name: "Classical Physics" },
      { id: "physics.comp-ph", name: "Computational Physics" },
      { id: "physics.data-an", name: "Data Analysis, Statistics and Probability" },
      { id: "physics.ed-ph", name: "Physics Education" },
      { id: "physics.flu-dyn", name: "Fluid Dynamics" },
      { id: "physics.gen-ph", name: "General Physics" },
      { id: "physics.geo-ph", name: "Geophysics" },
      { id: "physics.hist-ph", name: "History and Philosophy of Physics" },
      { id: "physics.ins-det", name: "Instrumentation and Detectors" },
      { id: "physics.med-ph", name: "Medical Physics" },
      { id: "physics.optics", name: "Optics" },
      { id: "physics.plasm-ph", name: "Plasma Physics" },
      { id: "physics.pop-ph", name: "Popular Physics" },
      { id: "physics.soc-ph", name: "Physics and Society" },
      { id: "physics.space-ph", name: "Space Physics" },
    ],
  },
  {
    id: "quant-ph",
    name: "Quantum Physics",
    categories: [
      { id: "quant-ph", name: "Quantum Physics" },
    ],
  },
  {
    id: "q-bio",
    name: "Quantitative Biology",
    categories: [
      { id: "q-bio.BM", name: "Biomolecules" },
      { id: "q-bio.CB", name: "Cell Behavior" },
      { id: "q-bio.GN", name: "Genomics" },
      { id: "q-bio.MN", name: "Molecular Networks" },
      { id: "q-bio.NC", name: "Neurons and Cognition" },
      { id: "q-bio.OT", name: "Other Quantitative Biology" },
      { id: "q-bio.PE", name: "Populations and Evolution" },
      { id: "q-bio.QM", name: "Quantitative Methods" },
      { id: "q-bio.SC", name: "Subcellular Processes" },
      { id: "q-bio.TO", name: "Tissues and Organs" },
    ],
  },
  {
    id: "q-fin",
    name: "Quantitative Finance",
    categories: [
      { id: "q-fin.CP", name: "Computational Finance" },
      { id: "q-fin.EC", name: "Economics" },
      { id: "q-fin.GN", name: "General Finance" },
      { id: "q-fin.MF", name: "Mathematical Finance" },
      { id: "q-fin.PM", name: "Portfolio Management" },
      { id: "q-fin.PR", name: "Pricing of Securities" },
      { id: "q-fin.RM", name: "Risk Management" },
      { id: "q-fin.ST", name: "Statistical Finance" },
      { id: "q-fin.TR", name: "Trading and Market Microstructure" },
    ],
  },
  {
    id: "stat",
    name: "Statistics",
    categories: [
      { id: "stat.AP", name: "Applications" },
      { id: "stat.CO", name: "Computation" },
      { id: "stat.ME", name: "Methodology" },
      { id: "stat.ML", name: "Machine Learning" },
      { id: "stat.OT", name: "Other Statistics" },
      { id: "stat.TH", name: "Statistics Theory" },
    ],
  },
];

/**
 * Flat lookup map derived from ARXIV_DOMAINS for display names
 */
const CATEGORY_DISPLAY_NAMES: Record<string, string> = Object.fromEntries(
  ARXIV_DOMAINS.flatMap((domain) =>
    domain.categories.map((cat) => [cat.id, cat.name])
  )
);

/**
 * Popular ArXiv categories (backward-compatible flat list, derived from ARXIV_DOMAINS)
 */
export const POPULAR_CATEGORIES = ARXIV_DOMAINS.flatMap((domain) =>
  domain.categories.map((cat) => ({ id: cat.id, name: cat.name }))
);

/**
 * Format authors list
 */
export function formatAuthors(authors: string[]): string {
  if (authors.length === 0) return "Unknown";
  if (authors.length <= 2) return authors.join(" and ");
  return `${authors[0]} et al.`;
}

/**
 * Format date for display
 */
export function formatArxivDate(dateString: string): string {
  const date = new Date(dateString);
  return date.toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

/**
 * Extract paper ID from ArXiv URL
 * Handles version suffixes (e.g., 2301.07041v1 -> 2301.07041)
 */
export function extractArxivId(url: string): string | null {
  const patterns = [
    /arxiv\.org\/abs\/(\d+\.\d+)v?\d*/,
    /arxiv\.org\/pdf\/(\d+\.\d+)v?\d*/,
    /arxiv\.org\/format\/(\d+\.\d+)v?\d*/,
  ];

  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match) return match[1];
  }

  return null;
}

/**
 * Get ArXiv PDF download URL
 * Strips version suffix if present (e.g., 2301.07041v1 -> 2301.07041)
 */
export function getArxivPdfUrl(paperId: string): string {
  // Strip version suffix if present
  const baseId = paperId.replace(/v\d+$/, '');
  return `https://arxiv.org/pdf/${baseId}.pdf`;
}

/**
 * Get ArXiv HTML URL
 * Strips version suffix if present (e.g., 2301.07041v1 -> 2301.07041)
 */
export function getArxivHtmlUrl(paperId: string): string {
  const baseId = paperId.replace(/v\d+$/, '');
  return `https://arxiv.org/html/${baseId}`;
}

/**
 * Save paper to library (placeholder for future implementation)
 */
export function savePaperToLibrary(paper: ArxivPaper): void {
  const saved = getSavedPapers();
  if (!saved.find((p) => p.id === paper.id)) {
    saved.push({
      ...paper,
      savedAt: new Date().toISOString(),
    });
    localStorage.setItem("arxiv_papers", JSON.stringify(saved));
  }
}

/**
 * Get saved papers
 */
export function getSavedPapers(): Array<ArxivPaper & { savedAt: string }> {
  const data = localStorage.getItem("arxiv_papers");
  return data ? JSON.parse(data) : [];
}

/**
 * Remove paper from library
 */
export function removePaperFromLibrary(paperId: string): void {
  const saved = getSavedPapers();
  const filtered = saved.filter((p) => p.id !== paperId);
  localStorage.setItem("arxiv_papers", JSON.stringify(filtered));
}

/**
 * Check if paper is saved
 */
export function isPaperSaved(paperId: string): boolean {
  const saved = getSavedPapers();
  return saved.some((p) => p.id === paperId);
}

/**
 * Import an ArXiv paper as a document
 * Downloads the PDF and creates a document in the library
 */
export async function importArxivPaper(
  paper: ArxivPaper
): Promise<{ 
  success: boolean; 
  filePath?: string;
  title?: string;
  authors?: string[];
  summary?: string;
  categories?: string[];
  published?: string;
  error?: string 
}> {
  try {
    const { fetchUrlContent } = await import("./documents");
    
    // Download the PDF from ArXiv
    const pdfUrl = getArxivPdfUrl(paper.id);
    const content = await fetchUrlContent(pdfUrl);
    
    if (!content.file_path) {
      return { success: false, error: "Failed to download PDF" };
    }
    
    return { 
      success: true, 
      filePath: content.file_path,
      title: paper.title,
      authors: paper.authors,
      summary: paper.summary,
      categories: paper.categories,
      published: paper.published,
    };
  } catch (error) {
    console.error("Failed to import ArXiv paper:", error);
    return { 
      success: false, 
      error: error instanceof Error ? error.message : "Failed to import paper" 
    };
  }
}
