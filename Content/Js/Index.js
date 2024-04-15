// Load Page
function init() {
    let facilitatorsList = [
        { Name: "Alex", Role: "tl", Team: "all" },
        { Name: "Jo&atilde;o", Role: "dev", Team: "beta" },
        { Name: "Stephan", Role: "dev", Team: "alpha" },
        { Name: "JD", Role: "dev", Team: "beta" },
        { Name: "Zhipeng", Role: "dev", Team: "alpha" },
        { Name: "Douglas", Role: "dev", Team: "alpha" },
        { Name: "Bruno", Role: "dev", Team: "alpha" },
        { Name: "Pavel", Role: "pm", Team: "all" },
        { Name: "Fati", Role: "pm", Team: "beta" },
        { Name: "Yusheng", Role: "pm", Team: "beta" },
    ];

    facilitatorsList.sort(SortByName);

    let facilitatorsDiv = document.getElementById("facilitatorsList");
    facilitatorsList.forEach((item, index) => {

        //input checkbox
        let button = document.createElement('button');
        $(button).css("width", 100);
        $(button).css("margin-bottom", 20);
        $(button).css("cursor", "pointer");
        $(button).addClass("btn btn-primary");
        $(button).html(item.Name);
        $(button).prop("role", item.Role);
        $(button).prop("team", item.Team);
        $(button).click(btnFacilitatorButtonClick);

        //div
        let div = document.createElement('div');
        $(div).addClass("col col-md-3");
        div.appendChild(button);

        // final div
        facilitatorsDiv.appendChild(div);

    });
    
}

// Main Functionality: define facilitator based on the configuration
// Called in the btnDefineFacilitator click event
function getFacilitator() {
    let buttons = getAllButtons();

    let facilitatorsArray = [];

    buttons.forEach((item, index) => {
        let isEnabled = $(item).hasClass("btn-primary");
        if (isEnabled)
            facilitatorsArray.push($(item).text());
    });

    if (facilitatorsArray.length > 0) {
        let randomNumber = Math.floor(Math.random() * facilitatorsArray.length);
        let facilitator = facilitatorsArray[randomNumber];

        let title = 'Congratulations, ' + facilitator + '!';
        let message = 'You are the chosen one!';

        Swal.fire({
            title: title,
            html: message,
            icon: 'success',
            confirmButtonText: 'Cool!'
        });

        unloadSpinner();
    }
    else {
        unloadSpinner();

        Swal.fire(
            "It's cold here... :(",
            "Is anyone there?",
            'question'
        )
    }
}

// Events / Clicks

function btnAll_Click() {
    let buttons = getAllButtons();
    buttons.forEach((item, index) => {
        enabledButton(item);
    });
}

function btnOnlyDevs_Click() {
    let buttons = getAllButtons();
    buttons.forEach((item, index) => {
        var role = $(item).prop("role");
        if (role.toLowerCase() == "dev") {
            enabledButton(item);
        }
        else {
            disabledButton(item);
        }

    });
}

function btnOnlyNonDevs_Click() {
    let buttons = getAllButtons();
    buttons.forEach((item, index) => {
        let role = $(item).prop("role");
        if (role.toLowerCase() != "dev") {
            enabledButton(item);
        }
        else {
            disabledButton(item);
        }

    });
}

function btnAlpha_Click() {
    let buttons = getAllButtons();
    buttons.forEach((item, index) => {
        let team = $(item).prop("team");
        if (team.toLowerCase() != "beta") {
            enabledButton(item);
        }
        else {
            disabledButton(item);
        }

    });
}

function btnBeta_Click() {
    let buttons = getAllButtons();
    buttons.forEach((item, index) => {
        var team = $(item).prop("team");
        if (team.toLowerCase() != "alpha") {
            enabledButton(item);
        }
        else {
            disabledButton(item);
        }

    });
}

function btnFacilitatorButtonClick() {
    let isEnabled = $(this).hasClass("btn-primary");

    if (isEnabled) {
        disabledButton(this);
    }
    else {
        enabledButton(this);
    }
}

function btnDefineFacilitator_Click() {

    loadSpinner();

    window.setTimeout(getFacilitator, 500);


}

// Sort Array
function SortByName(a, b) {
    let aName = a.Name.toLowerCase();
    let bName = b.Name.toLowerCase();
    return ((aName < bName) ? -1 : ((aName > bName) ? 1 : 0));
}

// Get All Buttons
function getAllButtons() {
    let buttons = document
        .getElementById("facilitatorsList")
        .querySelectorAll('button');
    return buttons;
}

// Spinner Functions
function loadSpinner() {
    document.getElementById("btnDefineFacilitator").setAttribute("disabled", true);
    document.getElementById("spinner").style.display = "inline-flex";
}

function unloadSpinner() {
    document.getElementById("btnDefineFacilitator").removeAttribute("disabled");
    document.getElementById("spinner").style.display = "none";
}

function enabledButton(button) {
    $(button).removeClass("btn-default");
    $(button).addClass("btn-primary");
    $(button).css("cursor", "pointer");
}

function disabledButton(button) {
    $(button).removeClass("btn-primary");
    $(button).addClass("btn-default");
    $(button).css("cursor", "not-allowed");
}



