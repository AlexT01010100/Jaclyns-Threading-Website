// opacity 0 --> 1 transition for images

document.addEventListener("DOMContentLoaded", function () {
    const galleryItems = document.querySelectorAll(".gallery-item");

    function fadeInOnScroll() {
        galleryItems.forEach((item) => {
            const itemTop = item.getBoundingClientRect().top;
            const windowHeight = window.innerHeight;

            if (itemTop < windowHeight) {
                item.classList.add("fade-in");
            }
        });
    }

    // Initial check on page load
    fadeInOnScroll();

    // Listen for scroll events
    window.addEventListener("scroll", fadeInOnScroll);
});

// images small --> large transition

// script.js

document.addEventListener("DOMContentLoaded", function () {
    const galleryItems = document.querySelectorAll(".gallery-item");

    function fadeInOnScroll() {
        galleryItems.forEach((item) => {
            const itemTop = item.getBoundingClientRect().top;
            const windowHeight = window.innerHeight;

            if (itemTop < windowHeight) {
                item.classList.add("fade-in");
            }
        });
    }

    // Initial check on page load
    fadeInOnScroll();

    // Listen for scroll events
    window.addEventListener("scroll", fadeInOnScroll);
});
