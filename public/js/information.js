// Select all FAQ toggle buttons
document.querySelectorAll('.faq-toggle').forEach(button => {
    // Initially display all FAQ content sections
    const content = button.nextElementSibling;
    content.style.display = 'block'; // Set all FAQ content to be visible by default

    // Add a click event listener to toggle visibility
    button.addEventListener('click', () => {
        // Toggle the display property on click
        content.style.display = content.style.display === 'block' ? 'none' : 'block';
    });
});
