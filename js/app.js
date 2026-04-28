document.addEventListener("DOMContentLoaded", () => {
    
    // Set Global Archive Date to Today
    window.globalArchiveDate = new Date(new Date().getTime() - (new Date().getTimezoneOffset() * 60000)).toISOString().split('T')[0];
    let dateInput = document.getElementById('global-archive-date');
    if(dateInput) {
        dateInput.value = window.globalArchiveDate;
        dateInput.addEventListener('change', (e) => {
            window.globalArchiveDate = e.target.value;
            // Force re-render of active tab if it's sensitive to date
            let activeRoute = document.querySelector('.nav-links li.active')?.getAttribute('data-route');
            if(activeRoute === 'post-clinic') {
                if (typeof UI !== 'undefined') UI.renderPostClinicBookings();
            }
            if(activeRoute === 'new-cases') {
                if (typeof UI !== 'undefined') UI.renderNewCasesMeeting();
            }
        });
    }

    // load saved settings
    if (typeof UI !== 'undefined') UI.loadSavedSettings();
    if (typeof UI !== 'undefined') UI.loadDarkMode();

    const navItems = document.querySelectorAll('.nav-links li');
    
    // Initial Load
    navItems.forEach(n => n.classList.remove('active'));
    let reportsTab = Array.from(navItems).find(n => n.getAttribute('data-route') === 'reports');
    if (reportsTab) reportsTab.classList.add('active');
    
    navigateTo('reports');
    
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
    
    // Global Keyboard Listeners
    document.addEventListener('keydown', (e) => {
        if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
            e.preventDefault();
            if(window.UI && UI.openSpotlight) UI.openSpotlight();
        }
    });
    
    function navigateTo(route) {
        if (window.UI) {
            UI.currentRoute = route;
            if (UI.clearFAB) UI.clearFAB();
        }
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
            case 'post-clinic':
                UI.renderPostClinicBookings();
                break;
            case 'master-registry':
                UI.renderMasterRegistry();
                break;
            case 'follow-up':
                UI.renderFollowUpView();
                break;
            case 'reports':
                UI.renderReports();
                break;
            case 'new-cases':
                UI.renderNewCasesMeeting();
                break;
            case 'bulk-actions':
                UI.renderBulkActions();
                break;
            case 'communications':
                UI.renderCommunications();
                break;
            default:
                UI.renderDashboard();
        }
    }
    window.navigateTo = navigateTo;
    
    // Sidebar Toggle Logic
    const menuToggleBtn = document.getElementById('menu-toggle-btn');
    const sidebar = document.querySelector('.sidebar');
    const sidebarOverlay = document.getElementById('sidebar-overlay');

    function toggleSidebar() {
        if (window.innerWidth <= 768) {
            // Mobile: slide in/out
            sidebar.classList.toggle('active');
            sidebarOverlay.classList.toggle('active');
        } else {
            // Desktop: collapse/expand
            sidebar.classList.toggle('collapsed');
        }
    }

    if (menuToggleBtn) menuToggleBtn.addEventListener('click', toggleSidebar);
    
    if (sidebarOverlay) {
        sidebarOverlay.addEventListener('click', () => {
            if (window.innerWidth <= 768) {
                sidebar.classList.remove('active');
                sidebarOverlay.classList.remove('active');
            }
        });
    }

    // Close sidebar when clicking a nav link on mobile
    navItems.forEach(item => {
        item.addEventListener('click', () => {
            if (window.innerWidth <= 768) {
                sidebar.classList.remove('active');
                sidebarOverlay.classList.remove('active');
            }
        });
    });

    // Register Service Worker for PWA
    if ('serviceWorker' in navigator) {
        window.addEventListener('load', () => {
            navigator.serviceWorker.register('sw.js')
                .then(registration => {
                    console.log('ServiceWorker registration successful with scope: ', registration.scope);
                }, err => {
                    console.log('ServiceWorker registration failed: ', err);
                });
        });
    }

    // PWA Install Prompt Logic
    let deferredPrompt;
    const installBanner = document.getElementById('install-banner');
    const installBtn = document.getElementById('install-btn');
    const closeInstallBtn = document.getElementById('close-install-btn');

    window.addEventListener('beforeinstallprompt', (e) => {
        // Prevent the mini-infobar from appearing on mobile
        e.preventDefault();
        // Stash the event so it can be triggered later.
        deferredPrompt = e;
        // Update UI notify the user they can install the PWA
        setTimeout(() => {
            if (installBanner) installBanner.classList.add('show');
        }, 1500);
    });

    if (installBtn) {
        installBtn.addEventListener('click', async () => {
            // Hide the app provided install promotion
            installBanner.classList.remove('show');
            // Show the install prompt
            if (deferredPrompt) {
                deferredPrompt.prompt();
                // Wait for the user to respond to the prompt
                const { outcome } = await deferredPrompt.userChoice;
                console.log(`User response to the install prompt: ${outcome}`);
                // We've used the prompt, and can't use it again, throw it away
                deferredPrompt = null;
            }
        });
    }

    if (closeInstallBtn) {
        closeInstallBtn.addEventListener('click', () => {
             installBanner.classList.remove('show');
        });
    }

    // Optionally Handle Successful Installation Event
    window.addEventListener('appinstalled', () => {
        // Hide the app-provided install promotion
        installBanner.classList.remove('show');
        // Clear the deferredPrompt so it can be garbage collected
        deferredPrompt = null;
        console.log('PWA was installed');
    });
});
