import React, { useRef, useEffect, useState } from "react";
import { ProseMirrorDoc } from "@handlewithcare/react-prosemirror";
import { Plugin } from "prosemirror-state";

const LINES_PER_PAGE = 55;
const LINE_HEIGHT_PT = 14.4; // 12pt * 1.2 line-height

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
        setTimeout(this.updatePagination, 0);
    }

    updatePagination() {
        const editorElement = this.view.dom;
        if (!editorElement) return;

        const paragraphs = editorElement.querySelectorAll('p');
        let totalLines = 0;

        paragraphs.forEach(p => {
            const rect = p.getBoundingClientRect();
            const lines = Math.ceil(rect.height / LINE_HEIGHT_PT);
            totalLines += Math.max(1, lines);
        });

        const pagesNeeded = Math.max(1, Math.ceil(totalLines / LINES_PER_PAGE));

        const event = new CustomEvent('paginationUpdate', {
            detail: { pagesNeeded, totalLines }
        });
        document.dispatchEvent(event);
    }

    destroy() { }
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

    useEffect(() => {
        const handlePageClick = (event) => {
            const proseMirrorEditor = document.querySelector('.ProseMirror');

            const clickedOnPage = event.target.closest('.page') || event.target.closest('.page-content');
            const clickedOnEditor = event.target.closest('.ProseMirror');

            if (clickedOnPage && proseMirrorEditor && !clickedOnEditor) {
                proseMirrorEditor.focus();

                const editorView = proseMirrorEditor.pmViewDesc?.view;
                if (editorView) {
                    const endPos = editorView.state.doc.content.size;
                    const tr = editorView.state.tr.setSelection(
                        editorView.state.selection.constructor.near(editorView.state.doc.resolve(endPos))
                    );
                    editorView.dispatch(tr);
                }
            }
        };

        document.addEventListener('click', handlePageClick);

        return () => {
            document.removeEventListener('click', handlePageClick);
        };
    }, []);

    const getPageNumber = (pageIndex) => {
        if (pageIndex === 0) return null;

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