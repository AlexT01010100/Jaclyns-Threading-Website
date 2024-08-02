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


document.addEventListener('DOMContentLoaded', function() {
    const galleryItems = document.querySelectorAll('.gallery-item');

    galleryItems.forEach(function(item) {
        item.addEventListener('click', function(event) {
            event.stopPropagation(); // Prevent event from propagating to parent elements

            if (!item.classList.contains('active')) {
                closeActiveItems(); // Close any previously active item
                item.classList.add('active');
                document.body.classList.add('modal-open');

                // Disable pointer events on all gallery items
                galleryItems.forEach(function(otherItem) {
                    otherItem.style.pointerEvents = 'none';
                });
            } else {
                item.classList.remove('active');
                document.body.classList.remove('modal-open');

                // Re-enable pointer events on all gallery items
                galleryItems.forEach(function(otherItem) {
                    otherItem.style.pointerEvents = 'auto';
                });
            }
        });
    });

    // Close active item when clicking outside of it
    document.addEventListener('click', function(event) {
        if (!event.target.closest('.gallery-item.active') && document.querySelector('.gallery-item.active')) {
            closeActiveItems();
        }
    });

    function closeActiveItems() {
        const activeItem = document.querySelector('.gallery-item.active');
        if (activeItem) {
            activeItem.classList.remove('active');
            document.body.classList.remove('modal-open');

            // Re-enable pointer events on all gallery items
            galleryItems.forEach(function(item) {
                item.style.pointerEvents = 'auto';
            });
        }
    }
});


