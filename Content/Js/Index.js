// Load Page
function init() {
    var facilitatorsList = [
        { Name: "Douglas", Role: "dev" },
        { Name: "Pavlina", Role: "ux" },
        { Name: "Reginaldo", Role: "sm" },
        { Name: "Priscila", Role: "dev" },
        { Name: "Alisson", Role: "dev" },
        { Name: "Brandon", Role: "tl" },
        { Name: "Djeefther", Role: "dev" },
        { Name: "Nil", Role: "dev" },
        { Name: "Jennifer", Role: "dev" }
    ];

    facilitatorsList.sort(SortByName);

    var facilitatorsDiv = document.getElementById("facilitatorsList");
    facilitatorsList.forEach((item, index) => {

        //input checkbox
        var button = document.createElement('button');
        $(button).css("width", 100);
        $(button).css("margin-bottom", 20);
        $(button).css("cursor", "pointer");
        $(button).addClass("btn btn-primary");
        $(button).html(item.Name);
        $(button).prop("role", item.Role);
        $(button).click(btnFacilitatorButtonClick);

        //div
        var div = document.createElement('div');
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

    var facilitatorsArray = [];

    buttons.forEach((item, index) => {
        var isEnabled = $(item).hasClass("btn-primary");
        if (isEnabled)
            facilitatorsArray.push($(item).text());
    });

    if (facilitatorsArray.length > 0) {
        var randomNumber = Math.floor(Math.random() * facilitatorsArray.length);
        var facilitator = facilitatorsArray[randomNumber];

        var title = 'Congratulations, ' + facilitator + '!';
        var message = 'You are the chosen one!';

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
    var buttons = getAllButtons();
    buttons.forEach((item, index) => {
        enabledButton(item);
    });
}

function btnOnlyDevs_Click() {
    var buttons = getAllButtons();
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
    var buttons = getAllButtons();
    buttons.forEach((item, index) => {
        var role = $(item).prop("role");
        if (role.toLowerCase() != "dev") {
            enabledButton(item);
        }
        else {
            disabledButton(item);
        }

    });
}

function btnFacilitatorButtonClick() {
    var isEnabled = $(this).hasClass("btn-primary");

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
    var aName = a.Name.toLowerCase();
    var bName = b.Name.toLowerCase();
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



