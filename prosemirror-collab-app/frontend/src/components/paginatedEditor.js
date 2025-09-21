import React, { useRef, useEffect, useState } from "react";
import { ProseMirrorDoc } from "@handlewithcare/react-prosemirror";
import { Plugin } from "prosemirror-state";

const LINES_PER_PAGE = 55;
const LINE_HEIGHT_PT = 14.4; // 12pt * 1.2 line-height

// Plugin to handle pagination
const paginationPlugin = new Plugin({
    view(editorView) {
        return new PaginationView(editorView);
    }
});

class PaginationView {
    constructor(view) {
        this.view = view;
        this.updatePagination = this.updatePagination.bind(this);
        this.update();
    }

    update() {
        // Delay pagination update to allow DOM to settle
        setTimeout(this.updatePagination, 0);
    }

    updatePagination() {
        const editorElement = this.view.dom;
        if (!editorElement) return;

        // Count lines by measuring paragraph heights
        const paragraphs = editorElement.querySelectorAll('p');
        let totalLines = 0;

        paragraphs.forEach(p => {
            const rect = p.getBoundingClientRect();
            const lines = Math.ceil(rect.height / LINE_HEIGHT_PT);
            totalLines += Math.max(1, lines); // Minimum 1 line per paragraph
        });

        const pagesNeeded = Math.max(1, Math.ceil(totalLines / LINES_PER_PAGE));

        // Dispatch custom event to update page count
        const event = new CustomEvent('paginationUpdate', {
            detail: { pagesNeeded, totalLines }
        });
        document.dispatchEvent(event);
    }

    destroy() {
        // Cleanup if needed
    }
}

function PaginatedEditor() {
    const [pages, setPages] = useState([1]);
    const containerRef = useRef(null);

    useEffect(() => {
        const handlePaginationUpdate = (event) => {
            const { pagesNeeded } = event.detail;
            const newPages = Array.from({ length: pagesNeeded }, (_, i) => i + 1);

            if (newPages.length !== pages.length) {
                setPages(newPages);
            }
        };

        document.addEventListener('paginationUpdate', handlePaginationUpdate);

        return () => {
            document.removeEventListener('paginationUpdate', handlePaginationUpdate);
        };
    }, [pages.length]);

    // Function to determine if a page should show a number
    const getPageNumber = (pageIndex) => {
        // First page (index 0) is not numbered
        if (pageIndex === 0) return null;

        // Second page (index 1) gets number 2
        // This follows the rule that the first numbered page is page 2
        return pageIndex + 1;
    };

    return (
        <div className="paginated-container" ref={containerRef}>
            {pages.map((pageNum, index) => {
                const displayPageNumber = getPageNumber(index);

                return (
                    <div key={pageNum} className="page" data-page={pageNum}>
                        <div className="page-content">
                            {index === 0 && (
                                <div className="editor-content">
                                    <ProseMirrorDoc spellCheck={false} />
                                </div>
                            )}
                            {index > 0 && (
                                <div className="page-overflow">
                                    {/* Content that flows from previous pages will be handled by CSS */}
                                </div>
                            )}
                        </div>
                        {displayPageNumber && (
                            <div className="page-number">{displayPageNumber}.</div>
                        )}
                    </div>
                );
            })}
        </div>
    );
}

export { paginationPlugin };
export default PaginatedEditor;