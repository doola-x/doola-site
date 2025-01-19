document.addEventListener("DOMContentLoaded", () => {
    // Toggle Sidebar
    const toggleSidebar = document.getElementById("toggleSidebar");
    const sidebar = document.getElementById("sidebar");
    const main = document.getElementById("mainContent");
    toggleSidebar.addEventListener("click", () => {
        sidebar.classList.toggle("collapsed");
	main.classList.toggle("collapsed");
    });

    // Navigation between pages
    const menuLinks = document.querySelectorAll(".menu-link");
    const pages = document.querySelectorAll(".page");
    menuLinks.forEach(link => {
        link.addEventListener("click", event => {
            event.preventDefault();
            const targetPage = link.dataset.page;
            pages.forEach(page => {
                page.classList.toggle("active", page.id === targetPage);
            });
        });
    });

    // Fetch and display games (placeholder function)
    const fetchGames = () => {
        const gameCards = document.getElementById("gameCards");
        gameCards.innerHTML = "<p>Loading games...</p>";
        // Example: Call Lichess API and populate gameCards
    };

    // Fetch live games (placeholder function)
    const fetchLiveGames = () => {
        const liveGames = document.getElementById("liveGames");
        liveGames.innerHTML = "<p>Loading live games...</p>";
        // Example: Call Lichess API and populate liveGames
    };

    // Fetch games on page load
    fetchGames();
    fetchLiveGames();
});

