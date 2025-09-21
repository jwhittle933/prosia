import React from "react";

const LINES_PER_PAGE = 55;
const LINE_HEIGHT = 14.4; // 12pt * 1.2 line-height in pixels
const PAGE_HEIGHT = LINES_PER_PAGE * LINE_HEIGHT;

function PaginatedDocument({ children }) {
    return (
        <div className="paginated-container">
            {children}
        </div>
    );
}

function Page({ pageNumber, children, isLast = false }) {
    return (
        <div className="page" data-page={pageNumber}>
            <div className="page-content">
                {children}
            </div>
            {!isLast && <div className="page-break" />}
        </div>
    );
}

export { PaginatedDocument, Page, LINES_PER_PAGE, PAGE_HEIGHT };