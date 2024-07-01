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

document.addEventListener("DOMContentLoaded", function () {
    const images = document.querySelectorAll(".sliding-image-container img");

    let currentIndex = 0;
    const intervalTime = 3000; // Time between slides in milliseconds
    let slideInterval;

    const nextSlide = () => {
        currentIndex = currentIndex < images.length - 1 ? currentIndex + 1 : 0;
        scrollToImage(currentIndex);
    };

    const scrollToImage = (index) => {
        const container = document.querySelector(".sliding-image-container");
        const image = images[index];
        container.scroll({
            left: image.offsetLeft,
            behavior: 'smooth'
        });
    };

    // Auto slide
    if (images.length > 1) {
        slideInterval = setInterval(nextSlide, intervalTime);
    }

    // Allow clicking on images to scroll to them
    images.forEach((img, index) => {
        img.addEventListener('click', () => {
            currentIndex = index;
            scrollToImage(currentIndex);
            clearInterval(slideInterval);
            slideInterval = setInterval(nextSlide, intervalTime);
        });
    });
});
