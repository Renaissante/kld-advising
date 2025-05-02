import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
  PaginationEllipsis,
} from "@/components/ui/pagination";

export function PaginationComponent({ currentPage, totalPages, onPageChange }) {
  // Helper function to change page
  const handlePageClick = (page) => {
    if (page < 1 || page > totalPages) return;
    onPageChange(page);
  };

  // Limit visible page numbers to 3 plus first and last pages.
  const maxVisiblePages = 3;
  const getPageItems = () => {
    // If total pages is small, show all page numbers
    if (totalPages <= maxVisiblePages + 2) {
      return Array.from({ length: totalPages }, (_, i) => i + 1);
    }
    const pages = [];
    // Always show the first page
    pages.push(1);
    
    // Determine the range of pages to show in the middle
    let start = Math.max(2, currentPage - 1);
    let end = Math.min(totalPages - 1, currentPage + 1);
    
    // Adjust if the current page is near the beginning or end
    if (currentPage === 1) {
      end = 3;
    }
    if (currentPage === totalPages) {
      start = totalPages - 2;
    }
    
    // Add ellipsis if there's a gap between the first page and start
    if (start > 2) {
      pages.push("ellipsis");
    }
    
    // Add the middle page numbers
    for (let i = start; i <= end; i++) {
      pages.push(i);
    }
    
    // Add ellipsis if there's a gap between end and the last page
    if (end < totalPages - 1) {
      pages.push("ellipsis");
    }
    
    // Always show the last page
    pages.push(totalPages);
    return pages;
  };

  const pageItems = getPageItems();

  return (
    <Pagination>
      <PaginationContent>
        <PaginationItem>
          <PaginationPrevious
            href="#"
            onClick={(e) => {
              e.preventDefault();
              handlePageClick(currentPage - 1);
            }}
            disabled={currentPage === 1}
          />
        </PaginationItem>
        {pageItems.map((item, index) =>
          item === "ellipsis" ? (
            <PaginationItem key={`ellipsis-${index}`}>
              <PaginationEllipsis />
            </PaginationItem>
          ) : (
            <PaginationItem key={item}>
              <PaginationLink
                href="#"
                onClick={(e) => {
                  e.preventDefault();
                  handlePageClick(item);
                }}
                isActive={item === currentPage}
              >
                {item}
              </PaginationLink>
            </PaginationItem>
          )
        )}
        <PaginationItem>
          <PaginationNext
            href="#"
            onClick={(e) => {
              e.preventDefault();
              handlePageClick(currentPage + 1);
            }}
            disabled={currentPage === totalPages}
          />
        </PaginationItem>
      </PaginationContent>
    </Pagination>
  );
}
