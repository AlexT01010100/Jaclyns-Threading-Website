document.querySelectorAll('.faq-toggle').forEach(button => {
    const content = button.nextElementSibling;

    content.style.display = 'block'; // Ensure content is visible
    button.classList.add('active'); // Ensure arrow is in the switched position

    // Add a click event listener to toggle visibility
    button.addEventListener('click', () => {
        const isCurrentlyOpen = content.style.display === 'block' || window.getComputedStyle(content).display === 'block';
        content.style.display = isCurrentlyOpen ? 'none' : 'block';

        // Toggle the arrow direction
        button.classList.toggle('active', !isCurrentlyOpen);
    });
});
