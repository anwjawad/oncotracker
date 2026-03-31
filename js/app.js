document.addEventListener("DOMContentLoaded", () => {
    
    const navItems = document.querySelectorAll('.nav-links li');
    
    // Initial Load
    navigateTo('dashboard');
    
    // Setup Routing
    navItems.forEach(item => {
        item.addEventListener('click', (e) => {
            // Update active state
            navItems.forEach(n => n.classList.remove('active'));
            e.currentTarget.classList.add('active');
            
            // Navigate
            let route = e.currentTarget.getAttribute('data-route');
            navigateTo(route);
        });
    });
    
    function navigateTo(route) {
        switch(route) {
            case 'dashboard':
                UI.renderDashboard();
                break;
            case 'patients':
                UI.renderPatients();
                break;
            case 'cases':
                UI.renderCases();
                break;
            case 'admissions':
                UI.renderAdmissions();
                break;
            case 'port-cath':
                UI.renderPortCath();
                break;
            case 'communications':
                UI.renderCommunications();
                break;
            default:
                UI.renderDashboard();
        }
    }
});
