function fadeInOnScroll() {
    const galleryItems = document.querySelectorAll(".gallery-item");
    galleryItems.forEach((item) => {
        const itemTop = item.getBoundingClientRect().top;
        const windowHeight = window.innerHeight;

        if (itemTop < windowHeight) {
            item.classList.add("fade-in");
        }
    });
}

document.addEventListener("DOMContentLoaded", function () {
    const galleryItems = document.querySelectorAll(".gallery-item");

    // Initial check on page load
    fadeInOnScroll();

    galleryItems.forEach((item) => {
        item.addEventListener('click', (event) => {
            event.stopPropagation(); // Prevent event from propagating to parent elements

            if (!item.classList.contains('active')) {
                closeActiveItems(); // Close any previously active item
                item.classList.add('active');
                document.body.classList.add('modal-open');

                // Disable pointer events on all gallery items
                galleryItems.forEach((otherItem) => {
                    otherItem.style.pointerEvents = 'none';
                });
            } else {
                item.classList.remove('active');
                document.body.classList.remove('modal-open');

                // Re-enable pointer events on all gallery items
                galleryItems.forEach((otherItem) => {
                    otherItem.style.pointerEvents = 'auto';
                });
            }
        });
    });

    window.addEventListener("scroll", fadeInOnScroll);

    // Close active item when clicking outside of it
    document.addEventListener('click', (event) => {
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
            galleryItems.forEach((item) => {
                item.style.pointerEvents = 'auto';
            });
        }
    }
});

