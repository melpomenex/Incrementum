/**
 * Custom PDF Text Selection Engine
 *
 * A geometric, coordinate-based selection system that bypasses native DOM
 * selection for smooth, precise text extraction from PDF documents.
 *
 * ## Usage
 *
 * ```tsx
 * import { usePdfCustomSelection, SelectionRenderer } from './selection';
 *
 * function PDFViewer({ pdf, documentId }) {
 *   const pageContainerRefs = useRef<(HTMLDivElement | null)[]>([]);
 *   const pageViewportRefs = useRef<(PageViewport | null)[]>([]);
 *
 *   const {
 *     selectionState,
 *     handlePointerDown,
 *     handlePointerMove,
 *     handlePointerUp,
 *     clearSelection,
 *     isReady,
 *   } = usePdfCustomSelection({
 *     pdf,
 *     documentId,
 *     pageContainerRefs,
 *     pageViewportRefs,
 *     enabled: true,
 *     onSelectionChange: (text, context) => {
 *       console.log('Selected:', text);
 *     },
 *   });
 *
 *   return (
 *     <div>
 *       {pages.map((page, i) => (
 *         <div
 *           key={i}
 *           ref={el => pageContainerRefs.current[i] = el}
 *           onPointerDown={e => handlePointerDown(i, e)}
 *           onPointerMove={e => handlePointerMove(i, e)}
 *           onPointerUp={e => handlePointerUp(i, e)}
 *         >
 *           <canvas />
 *           <SelectionRenderer pageIndex={i} selectionState={selectionState} />
 *         </div>
 *       ))}
 *     </div>
 *   );
 * }
 * ```
 */

// Types
export type {
  TextToken,
  LineBand,
  ColumnBoundary,
  PageTokenData,
  PageSelectionState,
  SelectionState,
  CustomSelectionResult,
  HitTestResult,
  TokenExtractorConfig,
  SelectionEngineState,
  UsePdfCustomSelectionOptions,
  UsePdfCustomSelectionResult,
} from "./types";

export { DEFAULT_EXTRACTOR_CONFIG } from "./types";

// Core classes
export { TokenExtractor } from "./TokenExtractor";
export { SpatialIndex, TokenUtils } from "./SpatialIndex";
export { SelectionEngine, resultToSelectionContext } from "./SelectionEngine";

// React components
export {
  SelectionRenderer,
  SVGSelectionRenderer,
  AllPagesSelectionRenderer,
  useSelectionRects,
} from "./SelectionRenderer";

// Main integration hook
export { usePdfCustomSelection } from "./usePdfCustomSelection";
