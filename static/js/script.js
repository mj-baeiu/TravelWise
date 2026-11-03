const destinationInput = document.getElementById("destination");
const startDateInput = document.getElementById("start-date");
const today = new Date();
const lastForecastDay = new Date(today);

// Store the latest planned trip for the AI assistant.
let currentTrip = null;

lastForecastDay.setDate(today.getDate() + 15);

function formatDateForInput(date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");

    return `${year}-${month}-${day}`;
}

startDateInput.min = formatDateForInput(today);
startDateInput.max = formatDateForInput(lastForecastDay);

const durationInput = document.getElementById("duration");
const durationHint = document.getElementById("duration-hint");

startDateInput.addEventListener("change", () => {
    if (!startDateInput.value) return;

    const selectedDate = new Date(`${startDateInput.value}T12:00:00`);

    const remainingDays = Math.round(
        (lastForecastDay - selectedDate) / (1000 * 60 * 60 * 24)
    ) + 1;

    durationInput.max = Math.min(16, remainingDays);

    durationHint.textContent =
        `🌤️ You can plan up to ${durationInput.max} ` +
        `${durationInput.max == 1 ? "day" : "days"} from this date.`;

    // Clear the duration if it exceeds the available forecast.
    if (Number(durationInput.value) > Number(durationInput.max)) {
        durationInput.value = "";
    }
});

const locationResults = document.getElementById("location-results");
const latitudeInput = document.getElementById("latitude");
const longitudeInput = document.getElementById("longitude");

destinationInput.addEventListener("input", () => {
    // The typed destination no longer matches the selected location.
    latitudeInput.value = "";
    longitudeInput.value = "";

    // Remove previous search results.
    locationResults.innerHTML = "";
});

let searchTimer;

const searchLocationButton = document.getElementById("search-location-btn");

searchLocationButton.addEventListener("click", () => {
    const query = destinationInput.value.trim();

    // Clear the previous selection when the user types again.
    latitudeInput.value = "";
    longitudeInput.value = "";
    locationResults.innerHTML = "";

    clearTimeout(searchTimer);

    if (query.length < 3) {
        return;
    }

    // Wait until the user pauses typing before searching.
    searchTimer = setTimeout(async () => {
        try {
            const response = await fetch(
                `/search-location?q=${encodeURIComponent(query)}`
            );

            if (!response.ok) {
                throw new Error("Location search failed.");
            }

            const locations = await response.json();

            // Ignore results if the user has changed the search text.
            if (destinationInput.value.trim() !== query) {
                return;
            }

            locationResults.innerHTML = "";

            if (locations.length === 0) {
                locationResults.textContent = "No locations found.";
                return;
            }

            locations.forEach((location) => {
                const option = document.createElement("button");
                option.type = "button";
                option.className = "location-option";
                option.textContent = location.display_name;

                option.addEventListener("click", () => {
                    destinationInput.value = location.display_name;
                    latitudeInput.value = location.lat;
                    longitudeInput.value = location.lon;

                    locationResults.innerHTML = "";
                });

                locationResults.appendChild(option);
            });

        } catch (error) {
            locationResults.textContent =
                "Unable to search locations. Please try again.";
            console.error(error);
        }
    }, 0);
});

const travelForm = document.getElementById("travel-form");

travelForm.addEventListener("submit", async (event) => {
    event.preventDefault();

    // Make sure the traveler selected a search result.
    if (!latitudeInput.value || !longitudeInput.value) {
        alert("Please search for and select a destination first.");
        return;
    }

    const travelData = {
        latitude: latitudeInput.value,
        longitude: longitudeInput.value,
        start_date: document.getElementById("start-date").value,
        duration: Number(document.getElementById("duration").value)
    };

    const submitButton = travelForm.querySelector('button[type="submit"]');

    submitButton.disabled = true;
    submitButton.textContent = "⏳ Planning your trip...";

    try {
        const response = await fetch("/plan", {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify(travelData)
        });

        const result = await response.json();

        if (!response.ok) {
            alert(result.error || "Something went wrong.");
            return;
        }

        console.log("Python response:", result);

        currentTrip = {
            destination: destinationInput.value.trim(),
            start_date: result.start_date,
            duration: result.duration,
            weather: result.weather
        };

        // Get the Trip Summary elements.
        const tripSummary = document.getElementById("trip-summary");
        const summaryDestination = document.getElementById("summary-destination");
        const summaryDate = document.getElementById("summary-date");
        const summaryDuration = document.getElementById("summary-duration");

        // Fill in the traveler's trip details.
        summaryDestination.textContent = destinationInput.value;
        summaryDate.textContent = new Date(
            `${result.start_date}T12:00:00`
        ).toLocaleDateString("en-US", {
            weekday: "long",
            year: "numeric",
            month: "long",
            day: "numeric"
        });

        summaryDuration.textContent =
            `${result.duration} ${result.duration === 1 ? "day" : "days"}`;

        const summaryOutlook = document.getElementById("summary-outlook");

        summaryOutlook.textContent = getOverallWeatherOutlook(result.weather);
        
        // Show the Trip Summary.
        tripSummary.hidden = false;

        const weatherSection = document.getElementById("weather-section");
        const weatherResults = document.getElementById("weather-results");

        // Clear previous results before showing a new forecast.
        weatherResults.innerHTML = "";

        function getWeatherDescription(code) {
            const weatherDescriptions = {
                0: "Clear Sky ☀️",
                1: "Mainly Clear 🌤️",
                2: "Partly Cloudy ⛅",
                3: "Overcast ☁️",
                45: "Foggy 🌫️",
                48: "Freezing Fog 🌫️",
                51: "Light Drizzle 🌦️",
                53: "Moderate Drizzle 🌦️",
                55: "Dense Drizzle 🌧️",
                61: "Slight Rain 🌧️",
                63: "Moderate Rain 🌧️",
                65: "Heavy Rain 🌧️",
                80: "Slight Rain Showers 🌦️",
                81: "Moderate Rain Showers 🌧️",
                82: "Violent Rain Showers ⛈️",
                95: "Thunderstorm ⛈️"
            };

            return weatherDescriptions[code] || "Weather condition unavailable";
        }

        function getTravelRecommendation(day) {
            const recommendations = [];

            if (day.rain_probability >= 60) {
                recommendations.push("☔ Bring an umbrella or raincoat.");
                recommendations.push("🏛️ Consider indoor activities.");
            }

            if (day.temperature_max >= 30) {
                recommendations.push("💧 Stay hydrated and bring sunscreen.");
            }

            if (day.temperature_min <= 18) {
                recommendations.push("🧥 Bring a jacket for cooler weather.");
            }

            if (day.rain_probability < 30 && day.temperature_max < 30) {
                recommendations.push("🌳 Great conditions for outdoor sightseeing!");
            }

            if (recommendations.length === 0) {
                recommendations.push("🎒 Pack comfortable clothes and check local conditions.");
            }

            return recommendations;
        }

        function getOverallWeatherOutlook(weatherDays) {
            const totalDays = weatherDays.length;

            const rainyDays = weatherDays.filter((day) => {
                return day.rain_probability >= 60;
            }).length;

            if (rainyDays === totalDays) {
                return "🌧️ Rain is likely throughout your trip. Bring an umbrella and plan some indoor activities.";
            }

            if (rainyDays > totalDays / 2) {
                return "🌦️ Rain is likely on most days. Pack rain protection and keep your plans flexible.";
            }

            if (rainyDays > 0) {
                return "⛅ Expect a mix of weather conditions. Some days may be rainy, so prepare accordingly.";
            }

            return "☀️ Rain chances are relatively low throughout your trip. Enjoy your sightseeing!";
        }

        // Create one card for each day of the trip.
        result.weather.forEach((day) => {
            const card = document.createElement("div");
            card.className = "weather-card";

            const date = document.createElement("h3");
            const formattedDate = new Date(`${day.date}T12:00:00`);
            date.textContent = formattedDate.toLocaleDateString("en-US", {
                weekday: "long",
                year: "numeric",
                month: "long",
                day: "numeric"
            });

            const condition = document.createElement("p");
            condition.textContent = getWeatherDescription(day.weather_code);

            const maxTemp = document.createElement("p");
            maxTemp.textContent = `🌡️ High: ${day.temperature_max}°C`;

            const minTemp = document.createElement("p");
            minTemp.textContent = `❄️ Low: ${day.temperature_min}°C`;

            const rain = document.createElement("p");
            rain.textContent = `🌧️ Rain chance: ${day.rain_probability}%`;
            
            const recommendationTitle = document.createElement("h4");
            recommendationTitle.textContent = "💡 Travel Tips";
            recommendationTitle.style.fontSize = "18px";

            const recommendationList = document.createElement("ul");

            const recommendations = getTravelRecommendation(day);

            recommendations.forEach((tip) => {
                const listItem = document.createElement("li");
                listItem.textContent = tip;
                recommendationList.appendChild(listItem);
            });

            card.appendChild(date);
            card.appendChild(condition);
            card.appendChild(maxTemp);
            card.appendChild(minTemp);
            card.appendChild(rain);
            card.appendChild(recommendationTitle);
            card.appendChild(recommendationList);

            weatherResults.appendChild(card);
        });

        // Reveal the forecast section.
        weatherSection.hidden = false;
    } catch (error) {
        console.error("Planning error:", error);
        alert("Unable to connect to the server.");
    } finally {
        submitButton.disabled = false;
        submitButton.textContent = "Check Weather & Plan Trip";
    }
});

// chatbot
const chatForm = document.getElementById("chat-form");
const chatInput = document.getElementById("chat-input");
const chatMessages = document.getElementById("chat-messages");

function addChatMessage(message, sender) {
    const messageBubble = document.createElement("div");

    messageBubble.className = `chat-message ${sender}-message`;
    messageBubble.textContent = message;

    chatMessages.appendChild(messageBubble);

    // Automatically scroll to the newest message.
    chatMessages.scrollTop = chatMessages.scrollHeight;
}

/* Show a typing indicator while AI is responding */
function showTypingIndicator() {
    const typingBubble = document.createElement("div");

    typingBubble.className = "chat-message bot-message";
    typingBubble.id = "typing-indicator";
    typingBubble.textContent = "TravelWise AI is typing...";

    chatMessages.appendChild(typingBubble);
    chatMessages.scrollTop = chatMessages.scrollHeight;
}

/* Display AI responses with a fast typewriter effect */
async function typeChatMessage(message) {
    const bubble = document.createElement("div");
    bubble.className = "chat-message bot-message";

    chatMessages.appendChild(bubble);

    const text = String(message).replace(
        /([^\n])\s+(\d+\.\s)/g,
        "$1\n\n$2"
    );
    const charactersPerStep = 4;
    const delay = 10;

    for (let i = 0; i < text.length; i += charactersPerStep) {
        bubble.textContent += text.slice(i, i + charactersPerStep);

        chatMessages.scrollTop = chatMessages.scrollHeight;

        await new Promise(resolve => setTimeout(resolve, delay));
    }
}

chatForm.addEventListener("submit", async (event) => {
    event.preventDefault();

    const userQuestion = chatInput.value.trim();

    if (!userQuestion) return;

    // Display the traveler's question.
    addChatMessage(userQuestion, "user");

    // Clear the input after sending.
    chatInput.value = "";

    showTypingIndicator();

    // Send the question to our Flask backend.
    try {
        const response = await fetch("/chat", {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                message: userQuestion,
                trip: currentTrip
            })
        });

        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.error || "Something went wrong.");
        }

        const typingIndicator = document.getElementById("typing-indicator");

        if (typingIndicator) {
            typingIndicator.remove();
        }

        await typeChatMessage(data.reply);

    } catch (error) {
        addChatMessage(
            "⚠️ Sorry, I couldn't process your question. " + error.message,
            "bot"
        );
    } finally {
        const typingIndicator = document.getElementById("typing-indicator");

        if (typingIndicator) {
            typingIndicator.remove();
        }
    }
});

/* Open and close the floating chatbot */
const chatbotToggle = document.getElementById("chatbot-toggle");

/* Close chatbot using the X button */
const chatbotClose = document.getElementById("chatbot-close");

chatbotClose.addEventListener("click", () => {
    chatbotSection.hidden = true;
    chatbotToggle.hidden = false;
    document.getElementById("chatbot-overlay").hidden = true;

    chatbotToggle.setAttribute(
        "aria-label",
        "Open TravelWise AI Assistant"
    );

    chatbotToggle.focus();
});

/* Close chatbot when Escape is pressed */
document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && !chatbotSection.hidden) {
        chatbotSection.hidden = true;
        chatbotToggle.hidden = false;
        document.getElementById("chatbot-overlay").hidden = true;

        chatbotToggle.focus();
    }
});

const chatbotSection = document.getElementById("chatbot-section");

chatbotToggle.addEventListener("click", () => {
    chatbotSection.hidden = !chatbotSection.hidden;

    const isOpen = !chatbotSection.hidden;

    chatbotToggle.setAttribute(
        "aria-label",
        isOpen ? "Close TravelWise AI Assistant" : "Open TravelWise AI Assistant"
    );

    if (isOpen) {
        document.getElementById("chat-input").focus();
    }

    chatbotToggle.hidden = !chatbotSection.hidden;
    const chatbotOverlay = document.getElementById("chatbot-overlay");
    chatbotOverlay.hidden = chatbotSection.hidden;
});