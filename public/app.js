// public/app.js - Carbon Footprint Tracker App (Full-Stack & AI Integrated)

// Global Chart Instances
let currentChartDoughnut = null;
let currentChartBar = null;

// Chat message history tracker (Last 6 messages sent to backend)
let chatMessageHistory = [];

// Local cache of user profile loaded from Express API
let cachedUserData = null;

// Toggleable view mode for interval analysis
let currentViewMode = 'yearly'; // 'yearly' or 'monthly'

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
    "Carpooling with a friend cuts vehicle emissions exactly in half."
];

// Document Load Event
document.addEventListener("DOMContentLoaded", () => {
    // 1. Run Loading Screen (1% to 100%)
    runStartupLoader();
    
    // 2. Initialize Event Listeners
    initApp();
});

// ==========================================================================
// API CLIENT UTILITY (JWT AUTH HANDSHAKES)
// ==========================================================================
async function callAPI(endpoint, method = 'GET', body = null) {
    const headers = {
        'Content-Type': 'application/json'
    };
    
    // Add JWT Token if authenticated
    const token = localStorage.getItem("terratrack_token");
    if (token) {
        headers['Authorization'] = `Bearer ${token}`;
    }
    
    // Add User's custom Gemini Key if configured in Settings
    const customKey = localStorage.getItem("terratrack_custom_ai_key");
    if (customKey) {
        headers['x-gemini-key'] = customKey;
    }
    
    // Add User's custom Model Name if configured in Settings
    const customModel = localStorage.getItem("terratrack_custom_ai_model");
    if (customModel) {
        headers['x-ai-model'] = customModel;
    }
    
    const config = {
        method,
        headers
    };
    
    if (body) {
        config.body = JSON.stringify(body);
    }
    
    const response = await fetch(endpoint, config);
    const data = await response.json();
    
    if (!response.ok) {
        throw new Error(data.error || 'API Request failed');
    }
    
    return data;
}

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
    
    const tipInterval = setInterval(() => {
        const randIndex = Math.floor(Math.random() * ECO_TIPS.length);
        tipText.textContent = `"${ECO_TIPS[randIndex]}"`;
    }, 1500);
    
    const progressInterval = setInterval(() => {
        const step = Math.floor(Math.random() * 8) + 2; 
        progress = Math.min(progress + step, 100);
        
        progressFill.style.width = `${progress}%`;
        percentageNum.textContent = progress;
        
        if (progress >= 100) {
            clearInterval(progressInterval);
            clearInterval(tipInterval);
            
            setTimeout(() => {
                loaderScreen.classList.add("fade-out");
                appContainer.classList.remove("hidden");
                
                lucide.createIcons();
                
                // Route user based on Auth session check
                checkAuth();
            }, 400);
        }
    }, 60); 
}

// ==========================================================================
// 2. APP INITIALIZATION & EVENT BINDINGS
// ==========================================================================
function initApp() {
    // Sliders
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

    // Set Date in dashboard
    const dashDateEl = document.getElementById("dash-date");
    if (dashDateEl) {
        const options = { year: 'numeric', month: 'long', day: 'numeric' };
        dashDateEl.textContent = new Date().toLocaleDateString('en-US', options);
    }
    
    // Auth Tabs Event Listeners
    document.getElementById("tab-login-btn").addEventListener("click", () => switchAuthTab('login'));
    document.getElementById("tab-signup-btn").addEventListener("click", () => switchAuthTab('signup'));
    
    // Auth Forms Submit
    document.getElementById("login-form").addEventListener("submit", handleLogin);
    document.getElementById("signup-form").addEventListener("submit", handleSignup);
    
    // Header Profile Trigger
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
    
    // Dropdown Item Actions
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
        if (cachedUserData && cachedUserData.responses) {
            showSection("dashboard-section");
            loadDashboard(cachedUserData);
        } else {
            showSection("quiz-section");
            startQuiz();
        }
    });
    
    // Quiz controls
    document.getElementById("quiz-next-btn").addEventListener("click", handleQuizNext);
    document.getElementById("quiz-prev-btn").addEventListener("click", handleQuizPrev);
    document.getElementById("quiz-skip-btn").addEventListener("click", handleQuizSkip);
    
    // AI Diagnosis Button
    document.getElementById("ai-generate-btn").addEventListener("click", handleAIGenerate);
    
    // AI Chatbot Submit Form
    document.getElementById("chat-input-form").addEventListener("submit", handleChatSubmit);
    
    // Analysis View Toggle
    const analysisToggle = document.getElementById("analysis-view-toggle");
    if (analysisToggle) {
        analysisToggle.addEventListener("change", (e) => {
            currentViewMode = e.target.checked ? 'monthly' : 'yearly';
            const yearlyLabel = document.getElementById("toggle-yearly-label");
            const monthlyLabel = document.getElementById("toggle-monthly-label");
            if (yearlyLabel && monthlyLabel) {
                if (currentViewMode === 'monthly') {
                    yearlyLabel.classList.remove("active");
                    monthlyLabel.classList.add("active");
                } else {
                    yearlyLabel.classList.add("active");
                    monthlyLabel.classList.remove("active");
                }
            }
            if (cachedUserData) {
                loadDashboard(cachedUserData);
            }
        });
    }
    
    // Modal controls
    document.getElementById("modal-close-x").addEventListener("click", closeSettingsModal);
    document.getElementById("modal-cancel-btn").addEventListener("click", closeSettingsModal);
    document.getElementById("modal-settings-form").addEventListener("submit", saveSettings);
    
    // Modal Tabs logic
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

async function checkAuth() {
    const token = localStorage.getItem("terratrack_token");
    if (!token) {
        showGuestHeader();
        showSection("auth-section");
        return;
    }
    
    try {
        // Handshake profile check with Node server
        const user = await callAPI('/api/profile');
        cachedUserData = user;
        showUserHeader(user);
        
        if (user.responses) {
            showSection("dashboard-section");
            loadDashboard(user);
        } else {
            showSection("quiz-section");
            startQuiz();
        }
    } catch (err) {
        console.error("Auth expired or failed:", err);
        handleLogout();
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
    
    document.getElementById("header-username").textContent = user.name.split(" ")[0];
    document.getElementById("user-avatar-initial").textContent = user.name.charAt(0).toUpperCase();
    
    document.getElementById("dropdown-username").textContent = user.name;
    document.getElementById("dropdown-email").textContent = user.email;
}

function switchAuthTab(tab) {
    const loginForm = document.getElementById("login-form");
    const signupForm = document.getElementById("signup-form");
    const tabLogin = document.getElementById("tab-login-btn");
    const tabSignup = document.getElementById("tab-signup-btn");
    
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

// ==========================================================================
// 3. FULL-STACK AUTHENTICATION EVENT HANDLERS
// ==========================================================================
async function handleSignup(e) {
    e.preventDefault();
    const name = document.getElementById("signup-name").value.trim();
    const email = document.getElementById("signup-email").value.trim();
    const password = document.getElementById("signup-password").value;
    const signupError = document.getElementById("signup-error-msg");
    
    try {
        const data = await callAPI('/api/auth/signup', 'POST', { name, email, password });
        localStorage.setItem("terratrack_token", data.token);
        document.getElementById("signup-form").reset();
        signupError.classList.add("hidden");
        await checkAuth();
    } catch (err) {
        signupError.textContent = err.message || "Sign up failed.";
        signupError.classList.remove("hidden");
    }
}

async function handleLogin(e) {
    e.preventDefault();
    const email = document.getElementById("login-email").value.trim();
    const password = document.getElementById("login-password").value;
    const loginError = document.getElementById("login-error-msg");
    
    try {
        const data = await callAPI('/api/auth/login', 'POST', { email, password });
        localStorage.setItem("terratrack_token", data.token);
        document.getElementById("login-form").reset();
        loginError.classList.add("hidden");
        await checkAuth();
    } catch (err) {
        loginError.textContent = err.message || "Invalid credentials.";
        loginError.classList.remove("hidden");
    }
}

function handleLogout() {
    localStorage.removeItem("terratrack_token");
    cachedUserData = null;
    showGuestHeader();
    showSection("auth-section");
}

// ==========================================================================
// 4. QUESTIONNAIRE WIZARD FLOW
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
    const panes = document.querySelectorAll(".quiz-step-pane");
    panes.forEach(pane => {
        if (parseInt(pane.getAttribute("data-pane")) === quizCurrentStep) {
            pane.classList.add("active");
        } else {
            pane.classList.remove("active");
        }
    });
    
    document.getElementById("quiz-category-title").textContent = quizStepData[quizCurrentStep].title;
    document.getElementById("quiz-category-desc").textContent = quizStepData[quizCurrentStep].desc;
    
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
    
    const percentage = ((quizCurrentStep - 1) / (totalQuizSteps - 1)) * 100;
    document.getElementById("quiz-progress-indicator").style.width = `${Math.max(percentage, 5)}%`;
    
    const prevBtn = document.getElementById("quiz-prev-btn");
    if (quizCurrentStep === 1) {
        prevBtn.style.visibility = "hidden";
    } else {
        prevBtn.style.visibility = "visible";
    }
    
    const nextBtn = document.getElementById("quiz-next-btn");
    if (quizCurrentStep === totalQuizSteps) {
        nextBtn.innerHTML = `Analyze <i data-lucide="sparkles"></i>`;
    } else {
        nextBtn.innerHTML = `Next <i data-lucide="arrow-right"></i>`;
    }
    
    lucide.createIcons();
    document.getElementById("quiz-error-msg").classList.add("hidden");
}

function validateCurrentStepInputs() {
    const pane = document.querySelector(`.quiz-step-pane[data-pane="${quizCurrentStep}"]`);
    const inputs = pane.querySelectorAll("input[required], select[required]");
    
    for (let input of inputs) {
        if (input.value === "" || input.value === null) {
            return false;
        }
    }
    return true;
}

function handleQuizNext() {
    if (!validateCurrentStepInputs()) {
        const errorMsg = document.getElementById("quiz-error-msg");
        errorMsg.textContent = "Please fill out all fields in this section, or click 'Skip Section' to proceed.";
        errorMsg.classList.remove("hidden");
        return;
    }
    
    proceedQuizStep();
}

function handleQuizSkip() {
    fillStepWithDefaultMockAnswers(quizCurrentStep);
    proceedQuizStep();
}

function proceedQuizStep() {
    if (quizCurrentStep < totalQuizSteps) {
        quizCurrentStep++;
        updateQuizStepUI();
    } else {
        saveQuizResponses();
    }
}

function handleQuizPrev() {
    if (quizCurrentStep > 1) {
        quizCurrentStep--;
        updateQuizStepUI();
    }
}

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

async function saveQuizResponses() {
    if (!cachedUserData) return;
    
    const responses = {
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
    
    try {
        const result = await callAPI('/api/profile', 'POST', { responses, name: responses.name });
        cachedUserData.responses = responses;
        cachedUserData.completedActions = [];
        showSection("dashboard-section");
        loadDashboard(cachedUserData);
    } catch (err) {
        alert("Failed to save responses: " + err.message);
    }
}

// ==========================================================================
// 5. LOCAL REAL-TIME CARBON CALCULATION (CLIENT-SIDE DYNAMIC FEEDBACK)
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
    const annualCommuteDistance = commuteKm * 300; 
    const primaryFactor = CARBON_FACTORS.transport[responses.transPrimary] || 0.0;
    const secondaryFactor = responses.transSecondary === 'none' ? primaryFactor : (CARBON_FACTORS.transport[responses.transSecondary] || 0.0);
    result.transport = (annualCommuteDistance * primaryFactor * 0.75) + (annualCommuteDistance * secondaryFactor * 0.25);
    
    // B. Food Footprint
    const dietFactor = CARBON_FACTORS.food[responses.diet] || 1800;
    const deliveryFactor = CARBON_FACTORS.delivery[responses.foodDelivery] || 60;
    result.food = dietFactor + deliveryFactor;
    
    // C. Home Energy Footprint (electricity and heating/cooling split by occupants)
    const household = Math.max(responses.household || 1, 1);
    const electricBillAnnual = responses.energyBill * 12;
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
    
    // Deductions from Checked Recommendation Actions
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
    result.total = parseFloat((grandTotalKg / 1000).toFixed(2));
    
    // Tonnage category conversions
    result.transport = parseFloat((result.transport / 1000).toFixed(2));
    result.food = parseFloat((result.food / 1000).toFixed(2));
    result.energy = parseFloat((result.energy / 1000).toFixed(2));
    result.waste = parseFloat((result.waste / 1000).toFixed(2));
    result.routine = parseFloat((result.routine / 1000).toFixed(2));
    
    return result;
}

function getActionSaving(actionId, responses) {
    const household = Math.max(responses.household || 1, 1);
    switch (actionId) {
        case "trans_carpool":
            return (responses.commuteKm * 300 * 0.08); 
        case "trans_transit":
            return (responses.commuteKm * 300 * 0.10); 
        case "food_meatless":
            return responses.diet === "meat-heavy" ? 450 : 200;
        case "food_cook":
            return responses.foodDelivery === "daily" ? 180 : 80;
        case "energy_led":
            return 120 / household; 
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
// 6. DASHBOARD & INTERACTIVE GRAPHICS (CHART.JS)
// ==========================================================================
function loadDashboard(user) {
    const responses = user.responses;
    if (!responses) return;
    
    // Welcome
    document.getElementById("dash-username").textContent = responses.name;
    
    // Calculations
    const footprint = calculateCarbonFootprint(responses, user.completedActions);
    
    // Scale footprint for UI presentation based on view mode
    let displayFootprint = { ...footprint };
    let unitLabelText = 'Metric Tons CO₂e / Yr';
    let compareTarget = 2.0;
    
    if (currentViewMode === 'monthly') {
        // Convert Metric Tons to kg, then divide by 12 months
        displayFootprint.total = parseFloat(((footprint.total * 1000) / 12).toFixed(1));
        displayFootprint.transport = parseFloat(((footprint.transport * 1000) / 12).toFixed(1));
        displayFootprint.food = parseFloat(((footprint.food * 1000) / 12).toFixed(1));
        displayFootprint.energy = parseFloat(((footprint.energy * 1000) / 12).toFixed(1));
        displayFootprint.waste = parseFloat(((footprint.waste * 1000) / 12).toFixed(1));
        displayFootprint.routine = parseFloat(((footprint.routine * 1000) / 12).toFixed(1));
        unitLabelText = 'kg CO₂e / Month';
        compareTarget = 167; // 2.0 tons = 2000 kg / 12 months = 166.67 => 167 kg limit
    } else {
        displayFootprint.total = parseFloat(footprint.total.toFixed(2));
        displayFootprint.transport = parseFloat(footprint.transport.toFixed(2));
        displayFootprint.food = parseFloat(footprint.food.toFixed(2));
        displayFootprint.energy = parseFloat(footprint.energy.toFixed(2));
        displayFootprint.waste = parseFloat(footprint.waste.toFixed(2));
        displayFootprint.routine = parseFloat(footprint.routine.toFixed(2));
    }
    
    // Metric score
    const footprintValueEl = document.getElementById("dash-footprint-value");
    footprintValueEl.textContent = displayFootprint.total;
    
    // Metric unit
    const footprintUnitEl = document.getElementById("dash-footprint-unit");
    if (footprintUnitEl) {
        footprintUnitEl.innerHTML = currentViewMode === 'monthly' ? 'kg CO<sub>2</sub>e / Month' : 'Metric Tons CO<sub>2</sub>e / Yr';
    }
    
    // Status Badge classes
    const statusBadge = document.getElementById("dash-status-badge");
    statusBadge.className = "metric-badge"; 
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
    const compareSub = document.getElementById("dash-compare-sub");
    
    const percentageOfTarget = Math.round((displayFootprint.total / compareTarget) * 100);
    comparePercentage.textContent = `${percentageOfTarget}%`;
    
    if (displayFootprint.total <= compareTarget) {
        compareText.textContent = "Awesome! You are below the 1.5°C global climate target.";
    } else {
        const diff = (displayFootprint.total - compareTarget).toFixed(currentViewMode === 'monthly' ? 0 : 1);
        const unitName = currentViewMode === 'monthly' ? 'kg' : 'tons';
        compareText.textContent = `You exceed the 1.5°C climate target limit by ${diff} ${unitName}.`;
    }
    
    if (compareSub) {
        if (currentViewMode === 'monthly') {
            compareSub.innerHTML = `The global limit to stop warming is <strong style="color:var(--primary-dark)">167 kg</strong> per month per person.`;
        } else {
            compareSub.innerHTML = `The global limit to stop warming is <strong style="color:var(--primary-dark)">2.0 tons</strong> per year per person.`;
        }
    }
    
    // Redraw charts
    renderCategoryBreakdownChart(displayFootprint);
    renderComparisonChart(footprint.total, responses.citytype);
    
    // Checklist
    renderRecommendations(user);
}

function renderCategoryBreakdownChart(footprint) {
    const ctx = document.getElementById('categoryChart').getContext('2d');
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
                            const tooltipUnit = currentViewMode === 'monthly' ? 'kg CO2e' : 'Metric Tons CO2e';
                            return ` ${context.label}: ${context.raw} ${tooltipUnit}`;
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
    if (currentChartBar) {
        currentChartBar.destroy();
    }
    
    let regionalAverage = 4.8; 
    if (cityType === 'urban') regionalAverage = 6.2;
    else if (cityType === 'rural') regionalAverage = 3.6;
    
    // Scale values if monthly
    let displayUserTotal = userTotal;
    let displayTarget = 2.0;
    let displayAverage = regionalAverage;
    let axisLabel = 'Tons CO2e / Year';
    let tooltipUnit = 'Tons CO2e';
    
    if (currentViewMode === 'monthly') {
        displayUserTotal = parseFloat(((userTotal * 1000) / 12).toFixed(1));
        displayTarget = 167;
        displayAverage = parseFloat(((regionalAverage * 1000) / 12).toFixed(1));
        axisLabel = 'kg CO2e / Month';
        tooltipUnit = 'kg CO2e';
    } else {
        displayUserTotal = parseFloat(userTotal.toFixed(2));
        displayTarget = 2.0;
        displayAverage = parseFloat(regionalAverage.toFixed(2));
    }
    
    currentChartBar = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: ['Your Footprint', '1.5°C Climate Target', 'Regional Average'],
            datasets: [{
                data: [displayUserTotal, displayTarget, displayAverage],
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
                            return ` ${context.raw} ${tooltipUnit}`;
                        }
                    }
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    title: {
                        display: true,
                        text: axisLabel,
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

function renderRecommendations(user) {
    const responses = user.responses;
    const recsListEl = document.getElementById("recommendations-list");
    recsListEl.innerHTML = ""; 
    
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
            desc: 'Swap driving for public transit twice a week to shrink commute travel footprint.',
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
            title: 'Sort Organic Food Waste',
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
    
    const activeActions = allActions.filter(action => action.condition());
    
    if (activeActions.length === 0) {
        activeActions.push(
            {
                id: 'energy_led',
                category: 'energy',
                title: 'Check Home insulation setup',
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
        
        let displaySaving = Math.round(savingKg);
        let savingUnit = 'kg CO₂e/Yr';
        
        if (currentViewMode === 'monthly') {
            displaySaving = Math.round(savingKg / 12);
            savingUnit = 'kg CO₂e/Mo';
        }
        
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
            <div class="rec-saving-badge">-${displaySaving} ${savingUnit}</div>
        `;
        
        itemEl.addEventListener("click", () => {
            toggleAction(action.id);
        });
        
        recsListEl.appendChild(itemEl);
    });
    
    let displayPotentialSaving = totalPotentialSavingKg;
    let potentialUnit = 'kg CO₂e/Yr';
    
    if (currentViewMode === 'monthly') {
        displayPotentialSaving = totalPotentialSavingKg / 12;
        potentialUnit = 'kg CO₂e/Mo';
    }
    
    document.getElementById("recs-potential-saving").textContent = displayPotentialSaving.toFixed(0);
    const potentialUnitEl = document.getElementById("recs-potential-unit");
    if (potentialUnitEl) {
        potentialUnitEl.innerHTML = potentialUnit === 'kg CO₂e/Mo' ? 'kg CO<sub>2</sub>e/Mo' : 'kg CO<sub>2</sub>e/Yr';
    }
    
    lucide.createIcons();
}

async function toggleAction(actionId) {
    if (!cachedUserData) return;
    
    const index = cachedUserData.completedActions.indexOf(actionId);
    if (index > -1) {
        cachedUserData.completedActions.splice(index, 1);
    } else {
        cachedUserData.completedActions.push(actionId);
    }
    
    // Instantly calculate and update view for zero-latency UI feel
    loadDashboard(cachedUserData);
    
    try {
        // Send updates to Express database in background
        await callAPI('/api/profile/actions', 'POST', { completedActions: cachedUserData.completedActions });
    } catch (err) {
        console.error("Failed to sync actions checklist with server:", err);
    }
}

// ==========================================================================
// 7. GEMINI AI API HANDLERS (DIAGNOSIS & CHAT WINDOW)
// ==========================================================================
async function handleAIGenerate() {
    if (!cachedUserData || !cachedUserData.responses) return;
    
    const skeleton = document.getElementById("ai-skeleton-loader");
    const insightsContent = document.getElementById("ai-insights-content");
    
    // Toggle Loading skeleton view
    skeleton.classList.remove("hidden");
    insightsContent.classList.add("hidden");
    
    const calculations = calculateCarbonFootprint(cachedUserData.responses, cachedUserData.completedActions);
    
    try {
        const data = await callAPI('/api/ai/insights', 'POST', {
            calculations,
            responses: cachedUserData.responses
        });
        
        // Output raw response HTML generated safely
        insightsContent.innerHTML = data.insights;
    } catch (err) {
        console.error("AI Insights compilation failed:", err);
        insightsContent.innerHTML = `
            <div class="error-message" style="margin-bottom:0">
                <strong>AI Generation Failed:</strong> ${err.message || 'Verification failed. Please review your API Key configurations.'}
            </div>
        `;
    } finally {
        skeleton.classList.add("hidden");
        insightsContent.classList.remove("hidden");
    }
}

async function handleChatSubmit(e) {
    e.preventDefault();
    const inputField = document.getElementById("chat-user-message");
    const messageText = inputField.value.trim();
    if (!messageText) return;
    
    const chatLog = document.getElementById("chat-messages-log");
    
    // Append User Message Bubble
    const userMsgEl = document.createElement("div");
    userMsgEl.className = "chat-message user";
    userMsgEl.innerHTML = `<div class="bubble">${escapeHTML(messageText)}</div>`;
    chatLog.appendChild(userMsgEl);
    
    // Clear Input and scroll down
    inputField.value = "";
    chatLog.scrollTop = chatLog.scrollHeight;
    
    // Append Temporary Bot Loading message
    const botLoadingEl = document.createElement("div");
    botLoadingEl.className = "chat-message bot loading";
    botLoadingEl.innerHTML = `<div class="bubble">Thinking...</div>`;
    chatLog.appendChild(botLoadingEl);
    chatLog.scrollTop = chatLog.scrollHeight;
    
    try {
        const responseData = await callAPI('/api/ai/chat', 'POST', {
            message: messageText,
            history: chatMessageHistory
        });
        
        // Remove thinking loader bubble
        chatLog.removeChild(botLoadingEl);
        
        // Append actual AI response bubble
        const botMsgEl = document.createElement("div");
        botMsgEl.className = "chat-message bot";
        botMsgEl.innerHTML = `<div class="bubble">${escapeHTML(responseData.reply)}</div>`;
        chatLog.appendChild(botMsgEl);
        
        // Save to chat message history log (Keep last 6 lines)
        chatMessageHistory.push({ role: 'user', text: messageText });
        chatMessageHistory.push({ role: 'model', text: responseData.reply });
        if (chatMessageHistory.length > 10) chatMessageHistory.shift();
        
    } catch (err) {
        chatLog.removeChild(botLoadingEl);
        
        // Append System error bubble
        const errorMsgEl = document.createElement("div");
        errorMsgEl.className = "chat-message bot system-error";
        errorMsgEl.innerHTML = `
            <div class="bubble" style="background-color:#fee2e2; border-color:#fca5a5; color:#b91c1c;">
                <strong>Error:</strong> ${err.message || 'Chat prompt failed. Please review your API Key configurations.'}
            </div>
        `;
        chatLog.appendChild(errorMsgEl);
    } finally {
        chatLog.scrollTop = chatLog.scrollHeight;
    }
}

function escapeHTML(text) {
    return text
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

// ==========================================================================
// 8. PROFILE & SETTINGS DIALOG (MODAL HANDLERS)
// ==========================================================================
function openSettingsModal() {
    if (!cachedUserData || !cachedUserData.responses) return;
    
    const r = cachedUserData.responses;
    
    document.getElementById("m-name").value = cachedUserData.name;
    document.getElementById("m-email").value = cachedUserData.email;
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
    
    // Load local storage custom API key in field (keeps key private in user browser)
    document.getElementById("m-ai-key").value = localStorage.getItem("terratrack_custom_ai_key") || "";
    
    // Load local storage custom model name
    document.getElementById("m-ai-model").value = localStorage.getItem("terratrack_custom_ai_model") || "";
    
    const modal = document.getElementById("settings-modal");
    modal.classList.remove("hidden");
    
    // Set default active tab
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

async function saveSettings(e) {
    e.preventDefault();
    if (!cachedUserData) return;
    
    const updatedName = document.getElementById("m-name").value.trim();
    
    const updatedResponses = {
        name: updatedName,
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
    
    // Save Custom API Key locally in browser
    const customKeyVal = document.getElementById("m-ai-key").value.trim();
    if (customKeyVal === "") {
        localStorage.removeItem("terratrack_custom_ai_key");
    } else {
        localStorage.setItem("terratrack_custom_ai_key", customKeyVal);
    }
    
    // Save Custom Model Name locally in browser
    const customModelVal = document.getElementById("m-ai-model").value.trim();
    if (customModelVal === "") {
        localStorage.removeItem("terratrack_custom_ai_model");
    } else {
        localStorage.setItem("terratrack_custom_ai_model", customModelVal);
    }
    
    try {
        await callAPI('/api/profile', 'POST', { responses: updatedResponses, name: updatedName });
        cachedUserData.name = updatedName;
        cachedUserData.responses = updatedResponses;
        showUserHeader(cachedUserData);
        closeSettingsModal();
        
        // Refresh dashboard instantly
        loadDashboard(cachedUserData);
    } catch (err) {
        alert("Failed to save changes: " + err.message);
    }
}
