// Reviews container
document.addEventListener("DOMContentLoaded", function () {
    const reviewsContainer = document.querySelector(".reviews");
    if (reviewsContainer) {
        // Calculate the middle scroll position
        const middleScroll = reviewsContainer.scrollWidth / 2 - reviewsContainer.clientWidth / 2;

        // Scroll to the middle
        reviewsContainer.scrollLeft = middleScroll;
    }
});
