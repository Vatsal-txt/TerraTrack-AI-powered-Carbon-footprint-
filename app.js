// app.js - Carbon Footprint Tracker App

// Global Variables
let currentChartDoughnut = null;
let currentChartBar = null;

// Standard Carbon Coefficient Factors (in kg CO2e)
const CARBON_FACTORS = {
    transport: {
        'diesel-car': 0.18,
        'electric-car': 0.04,
        'motorbike': 0.09,
        'bus': 0.07,
        'metro': 0.03,
        'walk': 0.0
    },
    food: {
        'vegan': 700,
        'vegetarian': 1100,
        'eggitarian': 1100,
        'pescatarian': 1400,
        'balanced': 1800,
        'meat-heavy': 2800
    },
    delivery: {
        'daily': 300,
        'half-week': 150,
        'weekly': 60,
        'rarely': 0
    },
    ac: {
        'none': 0,
        'low': 80,
        'medium': 200,
        'high': 400
    },
    fan: {
        'none': 0,
        'low': 10,
        'medium': 30,
        'high': 50
    },
    wasteSegregate: {
        'good': 0,
        'partial': 100,
        'none': 200
    },
    wasteRecycle: {
        'good': 0,
        'partial': 75,
        'none': 150
    },
    wastePlastic: {
        'none': 0,
        'low': 50,
        'mid': 150,
        'high': 300
    },
    routine: {
        'remote': 20,
        'office': 150,
        'hybrid': 75,
        'student': 50
    }
};

// Eco-tips array shown during loading
const ECO_TIPS = [
    "Switching to LED lights uses 75% less energy than standard bulbs.",
    "Public transport saves up to 2.2 metric tons of carbon emissions annually.",
    "Eating a plant-rich diet reduces your food emissions by up to 50%.",
    "Segregating organic compost prevents landfill methane release.",
    "Unplugging electronics on standby saves up to 10% on power bills.",
    "Carpooling with a friend cut vehicle emissions exactly in half."
];

// Document Load Event
document.addEventListener("DOMContentLoaded", () => {
    // 1. Run Loading Screen (1% to 100%)
    runStartupLoader();
    
    // 2. Initialize App Event Listeners & Auth check
    initApp();
});

// ==========================================================================
// 1. STARTUP LOADER LOGIC
// ==========================================================================
function runStartupLoader() {
    const progressFill = document.getElementById("loader-progress-fill");
    const percentageNum = document.getElementById("loader-percentage-num");
    const tipText = document.getElementById("loader-tip");
    const loaderScreen = document.getElementById("loader-screen");
    const appContainer = document.getElementById("app-container");
    
    let progress = 0;
    
    // Update tips every 1.5 seconds during loading
    const tipInterval = setInterval(() => {
        const randIndex = Math.floor(Math.random() * ECO_TIPS.length);
        tipText.textContent = `"${ECO_TIPS[randIndex]}"`;
    }, 1500);
    
    // Progress calculation
    const progressInterval = setInterval(() => {
        // Snappy irregular progress steps to simulate dynamic loading
        const step = Math.floor(Math.random() * 8) + 2; 
        progress = Math.min(progress + step, 100);
        
        progressFill.style.width = `${progress}%`;
        percentageNum.textContent = progress;
        
        if (progress >= 100) {
            clearInterval(progressInterval);
            clearInterval(tipInterval);
            
            // Wait brief moment, then fade loader out
            setTimeout(() => {
                loaderScreen.classList.add("fade-out");
                appContainer.classList.remove("hidden");
                
                // Trigger icons render
                lucide.createIcons();
                
                // Check user authentication
                checkAuth();
            }, 400);
        }
    }, 80); // Snap 1-100 in ~1.5 - 2s
}

// ==========================================================================
// 2. APP INITIALIZATION & ROUTING
// ==========================================================================
function initApp() {
    // Range inputs binding
    const commuteRange = document.getElementById("q-trans-commute");
    const commuteVal = document.getElementById("q-trans-commute-val");
    if (commuteRange && commuteVal) {
        commuteRange.addEventListener("input", (e) => {
            commuteVal.textContent = `${e.target.value} km`;
        });
    }
    
    const modalCommuteRange = document.getElementById("m-trans-commute");
    const modalCommuteVal = document.getElementById("m-trans-commute-val");
    if (modalCommuteRange && modalCommuteVal) {
        modalCommuteRange.addEventListener("input", (e) => {
            modalCommuteVal.textContent = `${e.target.value} km`;
        });
    }

    // Set Dashboard Date
    const dashDateEl = document.getElementById("dash-date");
    if (dashDateEl) {
        const options = { year: 'numeric', month: 'long', day: 'numeric' };
        dashDateEl.textContent = new Date().toLocaleDateString('en-US', options);
    }
    
    // Auth Tabs Event Listeners
    document.getElementById("tab-login-btn").addEventListener("click", () => switchAuthTab('login'));
    document.getElementById("tab-signup-btn").addEventListener("click", () => switchAuthTab('signup'));
    
    // Auth Forms Submission
    document.getElementById("login-form").addEventListener("submit", handleLogin);
    document.getElementById("signup-form").addEventListener("submit", handleSignup);
    
    // Profile Dropdown Menu Toggle
    const dropdownTrigger = document.getElementById("profile-dropdown-trigger");
    const dropdownMenu = document.getElementById("profile-dropdown-menu");
    
    dropdownTrigger.addEventListener("click", (e) => {
        e.stopPropagation();
        dropdownMenu.classList.toggle("show");
        dropdownTrigger.classList.toggle("active");
    });
    
    document.addEventListener("click", () => {
        if (dropdownMenu.classList.contains("show")) {
            dropdownMenu.classList.remove("show");
            dropdownTrigger.classList.remove("active");
        }
    });
    
    // Top Bar Sign In Click (Guest Mode Link)
    document.getElementById("header-login-btn").addEventListener("click", () => {
        showSection("auth-section");
    });
    
    // Dropdown Action Handlers
    document.getElementById("menu-logout").addEventListener("click", (e) => {
        e.preventDefault();
        handleLogout();
    });
    
    document.getElementById("menu-edit-profile").addEventListener("click", (e) => {
        e.preventDefault();
        openSettingsModal();
    });

    document.getElementById("menu-view-dashboard").addEventListener("click", (e) => {
        e.preventDefault();
        const user = getCurrentUser();
        if (user && user.responses) {
            showSection("dashboard-section");
            loadDashboard(user);
        } else {
            showSection("quiz-section");
            startQuiz();
        }
    });
    
    // Quiz Controls
    document.getElementById("quiz-next-btn").addEventListener("click", handleQuizNext);
    document.getElementById("quiz-prev-btn").addEventListener("click", handleQuizPrev);
    document.getElementById("quiz-skip-btn").addEventListener("click", handleQuizSkip);
    
    // Modal Event Listeners
    document.getElementById("modal-close-x").addEventListener("click", closeSettingsModal);
    document.getElementById("modal-cancel-btn").addEventListener("click", closeSettingsModal);
    document.getElementById("modal-settings-form").addEventListener("submit", saveSettings);
    
    // Modal Tab Buttons
    const modalTabButtons = document.querySelectorAll(".modal-tab-btn");
    modalTabButtons.forEach(btn => {
        btn.addEventListener("click", () => {
            modalTabButtons.forEach(b => b.classList.remove("active"));
            btn.classList.add("active");
            
            const targetPaneId = btn.getAttribute("data-target");
            const modalPanes = document.querySelectorAll(".modal-tab-pane");
            modalPanes.forEach(pane => pane.classList.remove("active"));
            document.getElementById(targetPaneId).classList.add("active");
        });
    });
}

function checkAuth() {
    const sessionEmail = localStorage.getItem("terratrack_session_email");
    if (!sessionEmail) {
        // Not authenticated: Route to Sign In
        showGuestHeader();
        showSection("auth-section");
    } else {
        const user = getCurrentUser();
        if (!user) {
            handleLogout();
            return;
        }
        
        showUserHeader(user);
        
        if (user.responses) {
            // Already took quiz: Show Dashboard
            showSection("dashboard-section");
            loadDashboard(user);
        } else {
            // Show Onboarding Questionnaire
            showSection("quiz-section");
            startQuiz();
        }
    }
}

function showSection(sectionId) {
    const sections = ["auth-section", "quiz-section", "dashboard-section"];
    sections.forEach(id => {
        const section = document.getElementById(id);
        if (id === sectionId) {
            section.classList.remove("hidden");
        } else {
            section.classList.add("hidden");
        }
    });
}

function showGuestHeader() {
    document.getElementById("guest-header-btn").classList.remove("hidden");
    document.getElementById("auth-header-btn").classList.add("hidden");
}

function showUserHeader(user) {
    document.getElementById("guest-header-btn").classList.add("hidden");
    document.getElementById("auth-header-btn").classList.remove("hidden");
    
    // Set UI initials and name
    document.getElementById("header-username").textContent = user.name.split(" ")[0];
    document.getElementById("user-avatar-initial").textContent = user.name.charAt(0).toUpperCase();
    
    document.getElementById("dropdown-username").textContent = user.name;
    document.getElementById("dropdown-email").textContent = user.email;
}

// ==========================================================================
// 3. AUTHENTICATION HANDLERS (LOCAL STORAGE DB)
// ==========================================================================
function getDBUsers() {
    const usersJson = localStorage.getItem("terratrack_users");
    return usersJson ? JSON.parse(usersJson) : {};
}

function saveDBUsers(users) {
    localStorage.setItem("terratrack_users", JSON.stringify(users));
}

function getCurrentUser() {
    const email = localStorage.getItem("terratrack_session_email");
    if (!email) return null;
    const users = getDBUsers();
    return users[email] || null;
}

function saveCurrentUser(user) {
    const users = getDBUsers();
    users[user.email] = user;
    saveDBUsers(users);
    showUserHeader(user);
}

function switchAuthTab(tab) {
    const loginForm = document.getElementById("login-form");
    const signupForm = document.getElementById("signup-form");
    const tabLogin = document.getElementById("tab-login-btn");
    const tabSignup = document.getElementById("tab-signup-btn");
    
    // Clear error messages
    document.getElementById("login-error-msg").classList.add("hidden");
    document.getElementById("signup-error-msg").classList.add("hidden");
    
    if (tab === 'login') {
        loginForm.classList.remove("hidden");
        signupForm.classList.add("hidden");
        tabLogin.classList.add("active");
        tabSignup.classList.remove("active");
    } else {
        loginForm.classList.add("hidden");
        signupForm.classList.remove("hidden");
        tabLogin.classList.remove("active");
        tabSignup.classList.add("active");
    }
}

function handleSignup(e) {
    e.preventDefault();
    const name = document.getElementById("signup-name").value.trim();
    const email = document.getElementById("signup-email").value.trim().toLowerCase();
    const password = document.getElementById("signup-password").value;
    const signupError = document.getElementById("signup-error-msg");
    
    const users = getDBUsers();
    if (users[email]) {
        signupError.textContent = "An account with this email already exists.";
        signupError.classList.remove("hidden");
        return;
    }
    
    // Create new user object
    users[email] = {
        name: name,
        email: email,
        password: password,
        responses: null,          // Footprint answers
        completedActions: []      // Completed check-list savings
    };
    
    saveDBUsers(users);
    localStorage.setItem("terratrack_session_email", email);
    
    // Reset form
    document.getElementById("signup-form").reset();
    signupError.classList.add("hidden");
    
    // Route to Quiz Onboarding
    checkAuth();
}

function handleLogin(e) {
    e.preventDefault();
    const email = document.getElementById("login-email").value.trim().toLowerCase();
    const password = document.getElementById("login-password").value;
    const loginError = document.getElementById("login-error-msg");
    
    const users = getDBUsers();
    const user = users[email];
    
    if (!user || user.password !== password) {
        loginError.textContent = "Invalid email address or password.";
        loginError.classList.remove("hidden");
        return;
    }
    
    localStorage.setItem("terratrack_session_email", email);
    
    // Reset form
    document.getElementById("login-form").reset();
    loginError.classList.add("hidden");
    
    // Route
    checkAuth();
}

function handleLogout() {
    localStorage.removeItem("terratrack_session_email");
    showGuestHeader();
    showSection("auth-section");
}

// ==========================================================================
// 4. QUESTIONNAIRE FLOW (STEPS WIZARD)
// ==========================================================================
let quizCurrentStep = 1;
const totalQuizSteps = 6;
const quizStepData = {
    1: { title: "Basic Information", desc: "Let's capture some essentials about your household size." },
    2: { title: "Transportation Habits", desc: "Your primary and secondary modes of daily commute." },
    3: { title: "Food Consumption", desc: "Your dietary preferences and online ordering frequency." },
    4: { title: "Home Energy Consumption", desc: "Approximate utility bills and daily heating/cooling usage." },
    5: { title: "Waste Management", desc: "Your sorting, recycling, and plastic consumption habits." },
    6: { title: "Daily Routine", desc: "Workplace configuration and typical weekly workflow settings." }
};

function startQuiz() {
    quizCurrentStep = 1;
    updateQuizStepUI();
    document.getElementById("quiz-form").reset();
    document.getElementById("q-trans-commute-val").textContent = "15 km";
}

function updateQuizStepUI() {
    // Show current step pane and hide others
    const panes = document.querySelectorAll(".quiz-step-pane");
    panes.forEach(pane => {
        if (parseInt(pane.getAttribute("data-pane")) === quizCurrentStep) {
            pane.classList.add("active");
        } else {
            pane.classList.remove("active");
        }
    });
    
    // Update Title and Subtitle descriptions
    document.getElementById("quiz-category-title").textContent = quizStepData[quizCurrentStep].title;
    document.getElementById("quiz-category-desc").textContent = quizStepData[quizCurrentStep].desc;
    
    // Update Sidebar Steps Indicator CSS
    const stepItems = document.querySelectorAll(".progress-steps-list .step-item");
    stepItems.forEach((item, index) => {
        const stepNum = index + 1;
        item.classList.remove("active", "completed");
        if (stepNum === quizCurrentStep) {
            item.classList.add("active");
        } else if (stepNum < quizCurrentStep) {
            item.classList.add("completed");
        }
    });
    
    // Update ProgressBar Percentage
    const percentage = ((quizCurrentStep - 1) / (totalQuizSteps - 1)) * 100;
    document.getElementById("quiz-progress-indicator").style.width = `${Math.max(percentage, 5)}%`;
    
    // Hide Back Button on Step 1
    const prevBtn = document.getElementById("quiz-prev-btn");
    if (quizCurrentStep === 1) {
        prevBtn.style.visibility = "hidden";
    } else {
        prevBtn.style.visibility = "visible";
    }
    
    // Change "Next" button to "Calculate Footprint" on the final step
    const nextBtn = document.getElementById("quiz-next-btn");
    if (quizCurrentStep === totalQuizSteps) {
        nextBtn.innerHTML = `Analyze <i data-lucide="sparkles"></i>`;
    } else {
        nextBtn.innerHTML = `Next <i data-lucide="arrow-right"></i>`;
    }
    
    // Trigger Lucide icons refreshing in button
    lucide.createIcons();
    
    // Hide Error Message
    document.getElementById("quiz-error-msg").classList.add("hidden");
}

function validateCurrentStepInputs() {
    const pane = document.querySelector(`.quiz-step-pane[data-pane="${quizCurrentStep}"]`);
    const inputs = pane.querySelectorAll("input[required], select");
    
    for (let input of inputs) {
        // Skip commute slider validation since it always has a numeric value
        if (input.id === "q-trans-commute") continue;
        
        if (input.value === "" || input.value === null) {
            return false;
        }
    }
    return true;
}

function handleQuizNext() {
    // If filling out the quiz, check if inputs are completed. Otherwise, user must click 'Skip Section'
    if (!validateCurrentStepInputs()) {
        const errorMsg = document.getElementById("quiz-error-msg");
        errorMsg.textContent = "Please fill out all fields in this section, or click 'Skip Section' if you want to skip.";
        errorMsg.classList.remove("hidden");
        return;
    }
    
    proceedQuizStep();
}

function handleQuizSkip() {
    // Set default/empty values for current step inputs to represent a skip
    fillStepWithDefaultMockAnswers(quizCurrentStep);
    proceedQuizStep();
}

function proceedQuizStep() {
    if (quizCurrentStep < totalQuizSteps) {
        quizCurrentStep++;
        updateQuizStepUI();
    } else {
        // On Step 6: Process and Submit
        saveQuizResponses();
    }
}

function handleQuizPrev() {
    if (quizCurrentStep > 1) {
        quizCurrentStep--;
        updateQuizStepUI();
    }
}

// Pre-fills form fields with mock defaults when skipped
function fillStepWithDefaultMockAnswers(step) {
    switch (step) {
        case 1:
            if (!document.getElementById("q-name").value) document.getElementById("q-name").value = "Eco Friend";
            if (!document.getElementById("q-age").value) document.getElementById("q-age").value = "30";
            if (!document.getElementById("q-city").value) document.getElementById("q-city").value = "Global Citizen";
            if (!document.getElementById("q-citytype").value) document.getElementById("q-citytype").value = "suburban";
            break;
        case 2:
            if (!document.getElementById("q-trans-primary").value) document.getElementById("q-trans-primary").value = "bus";
            if (!document.getElementById("q-trans-secondary").value) document.getElementById("q-trans-secondary").value = "none";
            break;
        case 3:
            if (!document.getElementById("q-food-diet").value) document.getElementById("q-food-diet").value = "balanced";
            if (!document.getElementById("q-food-delivery").value) document.getElementById("q-food-delivery").value = "weekly";
            break;
        case 4:
            if (!document.getElementById("q-energy-bill").value) document.getElementById("q-energy-bill").value = "60";
            if (!document.getElementById("q-energy-ac").value) document.getElementById("q-energy-ac").value = "low";
            if (!document.getElementById("q-energy-fan").value) document.getElementById("q-energy-fan").value = "medium";
            break;
        case 5:
            if (!document.getElementById("q-waste-segregate").value) document.getElementById("q-waste-segregate").value = "partial";
            if (!document.getElementById("q-waste-recycle").value) document.getElementById("q-waste-recycle").value = "partial";
            if (!document.getElementById("q-waste-plastic").value) document.getElementById("q-waste-plastic").value = "mid";
            break;
        case 6:
            if (!document.getElementById("q-routine-work").value) document.getElementById("q-routine-work").value = "hybrid";
            break;
    }
}

function saveQuizResponses() {
    const user = getCurrentUser();
    if (!user) return;
    
    // Read responses from DOM
    user.responses = {
        name: document.getElementById("q-name").value || "Eco Friend",
        age: parseInt(document.getElementById("q-age").value) || 30,
        city: document.getElementById("q-city").value || "Green Town",
        citytype: document.getElementById("q-citytype").value || "suburban",
        household: parseInt(document.getElementById("q-household").value) || 1,
        
        transPrimary: document.getElementById("q-trans-primary").value || "bus",
        transSecondary: document.getElementById("q-trans-secondary").value || "none",
        commuteKm: parseFloat(document.getElementById("q-trans-commute").value) || 0,
        
        diet: document.getElementById("q-food-diet").value || "balanced",
        foodDelivery: document.getElementById("q-food-delivery").value || "weekly",
        
        energyBill: parseFloat(document.getElementById("q-energy-bill").value) || 60,
        energyAC: document.getElementById("q-energy-ac").value || "low",
        energyFan: document.getElementById("q-energy-fan").value || "medium",
        
        wasteSegregate: document.getElementById("q-waste-segregate").value || "partial",
        wasteRecycle: document.getElementById("q-waste-recycle").value || "partial",
        wastePlastic: document.getElementById("q-waste-plastic").value || "mid",
        
        routineWork: document.getElementById("q-routine-work").value || "hybrid"
    };
    
    // Clear completed action plan list to reset checking state
    user.completedActions = [];
    
    saveCurrentUser(user);
    
    // Route to Dashboard
    showSection("dashboard-section");
    loadDashboard(user);
}

// ==========================================================================
// 5. CARBON CALCULATION ENGINE
// ==========================================================================
function calculateCarbonFootprint(responses, checkedActions = []) {
    let result = {
        transport: 0,
        food: 0,
        energy: 0,
        waste: 0,
        routine: 0,
        total: 0
    };
    
    if (!responses) return result;
    
    // A. Transportation Footprint
    const commuteKm = responses.commuteKm;
    const annualCommuteDistance = commuteKm * 300; // 300 commuting days/yr
    const primaryFactor = CARBON_FACTORS.transport[responses.transPrimary] || 0.0;
    const secondaryFactor = responses.transSecondary === 'none' ? primaryFactor : (CARBON_FACTORS.transport[responses.transSecondary] || 0.0);
    
    // 75% primary mode usage, 25% secondary mode usage
    result.transport = (annualCommuteDistance * primaryFactor * 0.75) + (annualCommuteDistance * secondaryFactor * 0.25);
    
    // B. Food Footprint
    const dietFactor = CARBON_FACTORS.food[responses.diet] || 1800;
    const deliveryFactor = CARBON_FACTORS.delivery[responses.foodDelivery] || 60;
    result.food = dietFactor + deliveryFactor;
    
    // C. Home Energy Footprint (electricity and heating/cooling split by occupants)
    const household = Math.max(responses.household || 1, 1);
    const electricBillAnnual = responses.energyBill * 12;
    // Assuming $1 = ~7 kWh, and grid emission factor is ~0.45 kg CO2e per kWh
    const electricFootprint = (electricBillAnnual * 7 * 0.45) / household;
    
    const acFootprint = (CARBON_FACTORS.ac[responses.energyAC] || 0) / household;
    const fanFootprint = (CARBON_FACTORS.fan[responses.energyFan] || 0) / household;
    
    result.energy = electricFootprint + acFootprint + fanFootprint;
    
    // D. Waste Footprint
    const segFactor = CARBON_FACTORS.wasteSegregate[responses.wasteSegregate] || 100;
    const recFactor = CARBON_FACTORS.wasteRecycle[responses.wasteRecycle] || 75;
    const plasticFactor = CARBON_FACTORS.wastePlastic[responses.wastePlastic] || 150;
    result.waste = segFactor + recFactor + plasticFactor;
    
    // E. Routine Footprint
    result.routine = CARBON_FACTORS.routine[responses.routineWork] || 75;
    
    // Apply Deductions from Checked Recommendation Actions
    checkedActions.forEach(actionId => {
        const saving = getActionSaving(actionId, responses);
        if (actionId.startsWith("trans_") && result.transport > saving) {
            result.transport -= saving;
        } else if (actionId.startsWith("food_") && result.food > saving) {
            result.food -= saving;
        } else if (actionId.startsWith("energy_") && result.energy > saving) {
            result.energy -= saving;
        } else if (actionId.startsWith("waste_") && result.waste > saving) {
            result.waste -= saving;
        } else if (actionId.startsWith("routine_") && result.routine > saving) {
            result.routine -= saving;
        }
    });
    
    // Sum Total (kg CO2e)
    const grandTotalKg = result.transport + result.food + result.energy + result.waste + result.routine;
    // Convert to Metric Tons (divided by 1000)
    result.total = parseFloat((grandTotalKg / 1000).toFixed(2));
    
    // Store category outputs in tons for dashboard presentation
    result.transport = parseFloat((result.transport / 1000).toFixed(2));
    result.food = parseFloat((result.food / 1000).toFixed(2));
    result.energy = parseFloat((result.energy / 1000).toFixed(2));
    result.waste = parseFloat((result.waste / 1000).toFixed(2));
    result.routine = parseFloat((result.routine / 1000).toFixed(2));
    
    return result;
}

// Action checklist savings coefficients (in kg CO2e / Year)
function getActionSaving(actionId, responses) {
    const household = Math.max(responses.household || 1, 1);
    switch (actionId) {
        case "trans_carpool":
            return (responses.commuteKm * 300 * 0.08); // Carparks saves substantial petrol
        case "trans_transit":
            return (responses.commuteKm * 300 * 0.10); // Transit over car
        case "food_meatless":
            return responses.diet === "meat-heavy" ? 450 : 200;
        case "food_cook":
            return responses.foodDelivery === "daily" ? 180 : 80;
        case "energy_led":
            return 120 / household; // Shared household saving
        case "energy_ac24":
            return responses.energyAC === "high" ? 220 / household : 80 / household;
        case "waste_segregate":
            return responses.wasteSegregate === "none" ? 120 : 50;
        case "waste_bags":
            return responses.wastePlastic === "high" ? 180 : 60;
        default:
            return 50;
    }
}

// ==========================================================================
// 6. DASHBOARD & GRAPH RENDERINGS (CHART.JS)
// ==========================================================================
function loadDashboard(user) {
    const responses = user.responses;
    if (!responses) return;
    
    // Display Username
    document.getElementById("dash-username").textContent = responses.name;
    
    // Calculate values
    const footprint = calculateCarbonFootprint(responses, user.completedActions);
    
    // Update main score
    const footprintValueEl = document.getElementById("dash-footprint-value");
    footprintValueEl.textContent = footprint.total;
    
    // Set Status Badge classes
    const statusBadge = document.getElementById("dash-status-badge");
    statusBadge.className = "metric-badge"; // reset
    if (footprint.total < 2.5) {
        statusBadge.textContent = "Eco Hero";
        statusBadge.classList.add("badge-eco");
    } else if (footprint.total >= 2.5 && footprint.total <= 6.0) {
        statusBadge.textContent = "Moderate Emitter";
        statusBadge.classList.add("badge-mod");
    } else {
        statusBadge.textContent = "High Carbon Footprint";
        statusBadge.classList.add("badge-high");
    }
    
    // Comparative Text
    const compareText = document.getElementById("dash-compare-text");
    const comparePercentage = document.getElementById("dash-compare-percentage");
    const targetVal = 2.0; // Metric Tons CO2e/Yr limit
    const percentageOfTarget = Math.round((footprint.total / targetVal) * 100);
    comparePercentage.textContent = `${percentageOfTarget}%`;
    
    if (footprint.total <= targetVal) {
        compareText.textContent = "Awesome! You are below the 1.5°C global climate target.";
    } else {
        compareText.textContent = `You exceed the 1.5°C climate target limit by ${Math.round(footprint.total - targetVal) || 1} tons.`;
    }
    
    // Draw Charts
    renderCategoryBreakdownChart(footprint);
    renderComparisonChart(footprint.total, responses.citytype);
    
    // Populate Actions Checklists
    renderRecommendations(user);
}

function renderCategoryBreakdownChart(footprint) {
    const ctx = document.getElementById('categoryChart').getContext('2d');
    
    // Destroy previous instance if exists to avoid overlap redraw canvas issues
    if (currentChartDoughnut) {
        currentChartDoughnut.destroy();
    }
    
    currentChartDoughnut = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: ['Transport', 'Food', 'Home Energy', 'Waste', 'Routine'],
            datasets: [{
                data: [
                    footprint.transport,
                    footprint.food,
                    footprint.energy,
                    footprint.waste,
                    footprint.routine
                ],
                backgroundColor: [
                    '#059669', // Emerald
                    '#34d399', // Mint
                    '#10b981', // Mid Emerald
                    '#6ee7b7', // Pale Mint
                    '#a7f3d0'  // Light Mint
                ],
                borderWidth: 2,
                borderColor: '#ffffff'
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    position: 'bottom',
                    labels: {
                        boxWidth: 12,
                        padding: 15,
                        font: {
                            family: 'Plus Jakarta Sans',
                            size: 12
                        }
                    }
                },
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            return ` ${context.label}: ${context.raw} Metric Tons CO2e`;
                        }
                    }
                }
            },
            cutout: '65%'
        }
    });
}

function renderComparisonChart(userTotal, cityType) {
    const ctx = document.getElementById('comparisonChart').getContext('2d');
    
    // Destroy previous instance
    if (currentChartBar) {
        currentChartBar.destroy();
    }
    
    // Different national average baselines based on city type
    let regionalAverage = 4.8; // default
    if (cityType === 'urban') regionalAverage = 6.2;
    else if (cityType === 'rural') regionalAverage = 3.6;
    
    currentChartBar = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: ['Your Footprint', '1.5°C Climate Target', 'Regional Average'],
            datasets: [{
                data: [userTotal, 2.0, regionalAverage],
                backgroundColor: [
                    '#065f46', // Dark Forest Green for User
                    '#10b981', // Mid Emerald for Target
                    '#9ca3af'  // Gray for average
                ],
                borderRadius: 8,
                barThickness: 32
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    display: false
                },
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            return ` ${context.raw} Tons CO2e`;
                        }
                    }
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    title: {
                        display: true,
                        text: 'Tons CO2e / Year',
                        font: {
                            family: 'Plus Jakarta Sans',
                            weight: 'bold'
                        }
                    },
                    grid: {
                        color: '#f3f4f6'
                    }
                },
                x: {
                    grid: {
                        display: false
                    }
                }
            }
        }
    });
}

// Generate Action list based on emissions hotspots
function renderRecommendations(user) {
    const responses = user.responses;
    const recsListEl = document.getElementById("recommendations-list");
    recsListEl.innerHTML = ""; // reset
    
    // Actions definitions
    const allActions = [
        {
            id: 'trans_carpool',
            category: 'transport',
            title: 'Try Carpooling to Work/School',
            desc: 'Carpooling twice a week cuts your personal travel carbon emissions substantially.',
            condition: () => ['diesel-car', 'motorbike'].includes(responses.transPrimary) && responses.commuteKm > 10
        },
        {
            id: 'trans_transit',
            category: 'transport',
            title: 'Commute via Metro or Bus',
            desc: 'Swap driving for electric public transit twice a week to shrink commute travel footprint.',
            condition: () => ['diesel-car'].includes(responses.transPrimary) && responses.commuteKm > 5
        },
        {
            id: 'food_meatless',
            category: 'food',
            title: 'Incorporate Meatless Mondays',
            desc: 'Replacing beef/poultry with plants/vegetables for 1 day/week saves up to 450kg CO2e annually.',
            condition: () => ['meat-heavy', 'balanced'].includes(responses.diet)
        },
        {
            id: 'food_cook',
            category: 'food',
            title: 'Cook at Home Instead of Deliveries',
            desc: 'Reduce delivery transit & plastic bag packaging footprints by cooking fresh ingredients.',
            condition: () => ['daily', 'half-week'].includes(responses.foodDelivery)
        },
        {
            id: 'energy_led',
            category: 'energy',
            title: 'Install Energy-saving LED Bulbs',
            desc: 'Replace incandescent lighting with LED, cutting household light consumption by 75%.',
            condition: () => responses.energyBill > 30
        },
        {
            id: 'energy_ac24',
            category: 'energy',
            title: 'Set AC Thermostat to 24°C / 75°F',
            desc: 'Avoid set-points below 24°C. Higher AC settings consume up to 18% less electricity.',
            condition: () => ['high', 'medium'].includes(responses.energyAC)
        },
        {
            id: 'waste_segregate',
            category: 'waste',
            title: 'Sort Organic Organic Waste',
            desc: 'Prevent paper & organic food waste from reaching landfills and producing methane.',
            condition: () => ['none', 'partial'].includes(responses.wasteSegregate)
        },
        {
            id: 'waste_bags',
            category: 'waste',
            title: 'Decline Single-use Plastic Water Bottles',
            desc: 'Switch to a reusable flask and canvas bags to eliminate micro-plastic production cycle.',
            condition: () => ['high', 'mid'].includes(responses.wastePlastic)
        }
    ];
    
    // Filter active actions based on user conditions
    const activeActions = allActions.filter(action => action.condition());
    
    // If no actions trigger (extremely eco-friendly user), give general actions
    if (activeActions.length === 0) {
        activeActions.push(
            {
                id: 'energy_led',
                category: 'energy',
                title: 'Check Home LED Insulation',
                desc: 'Optimize house window setups to reduce draft heating leaks.'
            },
            {
                id: 'waste_segregate',
                category: 'waste',
                title: 'Start local composting',
                desc: 'Compost dry leaves and raw food waste into healthy nutrient soil.'
            }
        );
    }
    
    let totalPotentialSavingKg = 0;
    
    activeActions.forEach(action => {
        const isCompleted = user.completedActions.includes(action.id);
        const savingKg = getActionSaving(action.id, responses);
        
        totalPotentialSavingKg += savingKg;
        
        const itemEl = document.createElement("div");
        itemEl.className = `rec-item ${isCompleted ? 'completed' : ''}`;
        itemEl.innerHTML = `
            <div class="rec-checkbox">
                <i data-lucide="check"></i>
            </div>
            <div class="rec-text">
                <div class="rec-title">${action.title}</div>
                <div class="rec-desc">${action.desc}</div>
            </div>
            <div class="rec-saving-badge">-${Math.round(savingKg)} kg CO₂e</div>
        `;
        
        // Checklist checkbox click event
        itemEl.addEventListener("click", () => {
            toggleAction(action.id);
        });
        
        recsListEl.appendChild(itemEl);
    });
    
    // Potential saving display in Tons
    document.getElementById("recs-potential-saving").textContent = (totalPotentialSavingKg).toFixed(0);
    
    // Re-draw lucide check marks
    lucide.createIcons();
}

function toggleAction(actionId) {
    const user = getCurrentUser();
    if (!user) return;
    
    const index = user.completedActions.indexOf(actionId);
    if (index > -1) {
        // Remove check
        user.completedActions.splice(index, 1);
    } else {
        // Add check
        user.completedActions.push(actionId);
    }
    
    saveCurrentUser(user);
    
    // Reload dashboard state to recalculate emissions in real-time
    loadDashboard(user);
}

// ==========================================================================
// 7. PROFILE & QUIZ SETTINGS MODAL DIALOG
// ==========================================================================
function openSettingsModal() {
    const user = getCurrentUser();
    if (!user || !user.responses) return;
    
    const r = user.responses;
    
    // Fill Modal Inputs
    document.getElementById("m-name").value = user.name;
    document.getElementById("m-email").value = user.email;
    document.getElementById("m-age").value = r.age;
    document.getElementById("m-city").value = r.city;
    document.getElementById("m-citytype").value = r.citytype;
    document.getElementById("m-household").value = r.household;
    
    document.getElementById("m-trans-primary").value = r.transPrimary;
    document.getElementById("m-trans-secondary").value = r.transSecondary;
    document.getElementById("m-trans-commute").value = r.commuteKm;
    document.getElementById("m-trans-commute-val").textContent = `${r.commuteKm} km`;
    
    document.getElementById("m-food-diet").value = r.diet;
    document.getElementById("m-food-delivery").value = r.foodDelivery;
    
    document.getElementById("m-energy-bill").value = r.energyBill;
    document.getElementById("m-energy-ac").value = r.energyAC;
    document.getElementById("m-energy-fan").value = r.energyFan;
    
    document.getElementById("m-waste-segregate").value = r.wasteSegregate;
    document.getElementById("m-waste-recycle").value = r.wasteRecycle;
    document.getElementById("m-waste-plastic").value = r.wastePlastic;
    
    document.getElementById("m-routine-work").value = r.routineWork;
    
    // Show Modal overlay
    const modal = document.getElementById("settings-modal");
    modal.classList.remove("hidden");
    
    // Default active tab in modal
    const tabBtns = document.querySelectorAll(".modal-tab-btn");
    const tabPanes = document.querySelectorAll(".modal-tab-pane");
    tabBtns.forEach((b, i) => {
        if (i === 0) b.classList.add("active");
        else b.classList.remove("active");
    });
    tabPanes.forEach((p, i) => {
        if (i === 0) p.classList.add("active");
        else p.classList.remove("active");
    });
}

function closeSettingsModal() {
    document.getElementById("settings-modal").classList.add("hidden");
}

function saveSettings(e) {
    e.preventDefault();
    const user = getCurrentUser();
    if (!user) return;
    
    // Save updated name in user object
    user.name = document.getElementById("m-name").value.trim();
    
    // Update responses
    user.responses = {
        name: user.name,
        age: parseInt(document.getElementById("m-age").value) || 30,
        city: document.getElementById("m-city").value.trim() || "Green Town",
        citytype: document.getElementById("m-citytype").value || "suburban",
        household: parseInt(document.getElementById("m-household").value) || 1,
        
        transPrimary: document.getElementById("m-trans-primary").value || "bus",
        transSecondary: document.getElementById("m-trans-secondary").value || "none",
        commuteKm: parseFloat(document.getElementById("m-trans-commute").value) || 0,
        
        diet: document.getElementById("m-food-diet").value || "balanced",
        foodDelivery: document.getElementById("m-food-delivery").value || "weekly",
        
        energyBill: parseFloat(document.getElementById("m-energy-bill").value) || 60,
        energyAC: document.getElementById("m-energy-ac").value || "low",
        energyFan: document.getElementById("m-energy-fan").value || "medium",
        
        wasteSegregate: document.getElementById("m-waste-segregate").value || "partial",
        wasteRecycle: document.getElementById("m-waste-recycle").value || "partial",
        wastePlastic: document.getElementById("m-waste-plastic").value || "mid",
        
        routineWork: document.getElementById("m-routine-work").value || "hybrid"
    };
    
    saveCurrentUser(user);
    closeSettingsModal();
    
    // Refresh dashboard to display updated totals & graphs instantly
    loadDashboard(user);
}
