// JavaScript for toggling the navbar menu
function toggleMenu() {
    var navbarMenu = document.getElementById("navbarMenu");
    navbarMenu.classList.toggle("active");
}

// Close the menu if clicking outside of it
document.addEventListener('click', function(event) {
    var navbarMenu = document.getElementById("navbarMenu");
    var icon = document.querySelector('.navbar .icon');
    if (!navbarMenu.contains(event.target) && event.target !== icon) {
        navbarMenu.classList.remove('active');
    }
});
