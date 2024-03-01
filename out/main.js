"use strict";
function getElementByClass(parentDiv, className) {
    let children = parentDiv.getElementsByClassName(className);
    if (children.length == 0) {
        throw new Error('Could not find element with class:' + className + ' in ' + parentDiv);
    }
    return children[0];
}
function shuffleArray(array) {
    // Fisher–Yates shuffle of an array in place
    for (let i = array.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [array[i], array[j]] = [array[j], array[i]];
    }
}
function removeNodeChildren(node) {
    while (node.children.length > 0) {
        node.removeChild(node.children[0]);
    }
}
function isHigher(startCard, endCard) {
    // Tests if the end card is one higher in value and the same suit as the start card
    return (startCard.suit === endCard.suit) && (startCard.value + 1 === endCard.value);
}
function isLower(startCard, endCard) {
    return (startCard.suit === endCard.suit) && (startCard.value - 1 === endCard.value);
}
function isSelectionEqual(selection0, selection1) {
    if (selection0 == undefined || selection1 == undefined) {
        return false;
    }
    return (selection0.location === selection1.location && selection0.column === selection1.column && selection0.row === selection1.row);
}
function isAnySelectionEqual(selection, options) {
    for (let option of options) {
        if (isSelectionEqual(selection, option)) {
            return true;
        }
    }
    return false;
}
function stringifyCard(card) {
    return "0A23456789TJQKabcdefgh"[card.value] + "zsdch"[card.suit];
}
let emptyCard = { value: 0, suit: 0, selectionType: "none", };
class Game {
    constructor(state = undefined, numColumns = 8, numFreeCells = 4, hardColumns = false) {
        // Setup other base variables
        this.selectionOptions = [];
        this.currentSelection = undefined;
        this.autoFoundations = true;
        // Load state or start new state
        if (state === undefined) {
            this.numColumns = numColumns;
            this.numFreeCells = numFreeCells;
            this.hardColumns = hardColumns;
            //Setup state
            this.state = {
                freeCells: [],
                foundations: [],
                columns: [],
            };
            // Deal a new game
            this.newGame();
        }
        else {
            this.numColumns = numColumns;
            this.numFreeCells = numFreeCells;
            this.hardColumns = hardColumns;
            // Set the state for the new game
            this.state = state;
            //Calculate the start options
            this.calculateStartOptions();
        }
    }
    newGame() {
        //Setup state
        this.state = {
            freeCells: [],
            foundations: [],
            columns: [],
        };
        //Add empty cards and empty cells; Freecells, foundations, columns
        for (let i = 0; i < this.numFreeCells; i++) {
            this.state.freeCells.push({ value: 0, suit: 0, selectionType: "none" });
        }
        for (let i = 0; i < 4; i++) {
            this.state.foundations.push([{ value: 0, suit: i + 1, selectionType: "none" }]);
        }
        for (let i = 0; i < this.numColumns; i++) {
            this.state.columns.push([{ value: 0, suit: 0, selectionType: "none" }]);
        }
        //Create a deck and shuffle it
        let deck = [];
        for (let i = 1; i <= 13; i++) {
            for (let j = 1; j <= 4; j++) {
                deck.push({ value: i, suit: j, selectionType: "none" });
            }
        }
        shuffleArray(deck);
        //Deal the cards
        let col = 0;
        for (let card of deck) {
            this.state.columns[col].push(card);
            col += 1;
            if (col == this.numColumns) {
                col = 0;
            }
        }
        //Calculate the start options
        this.calculateStartOptions();
    }
    getCardFromSelection(selection) {
        // freeCell
        if (selection.location === "freeCell") {
            // freeCell selection
            return this.state.freeCells[selection.column];
        }
        else if (selection.location === "foundation") {
            // foundation selection
            return this.state.foundations[selection.column][selection.row];
        }
        else if (selection.location == "column") {
            // column selection
            return this.state.columns[selection.column][selection.row];
        }
        else {
            throw new Error("Invalid selection location" + selection.location);
        }
    }
    select(selection) {
        // performs appropriate actions when a selection is made
        // Start by clearing all selections already made
        // console.log("clicked", selection, this.getCardFromSelection(selection));
        let previousSelectionOptions = this.selectionOptions;
        this.setSelectionTypeForOptions("none", this.selectionOptions);
        this.selectionOptions = [];
        let previousSelection = this.currentSelection;
        if (this.currentSelection != undefined) {
            this.setSelectionTypeForOptions("none", [this.currentSelection]);
            this.currentSelection = undefined;
        }
        if (isAnySelectionEqual(selection, previousSelectionOptions)) {
            if (previousSelection == undefined) {
                // Get the START - where a card is coming from
                let card = this.getCardFromSelection(selection);
                card.selectionType = "start";
                this.currentSelection = selection;
                this.selectionOptions = this.calculateEndOptions(selection);
                this.setSelectionTypeForOptions("end", this.selectionOptions);
            }
            else {
                // SET THE END - where a card is going to
                let card = this.getCardFromSelection(previousSelection);
                // remove the card from current location
                if (previousSelection.location == "freeCell") {
                    this.state.freeCells[previousSelection.column] = { selectionType: "none", value: 0, suit: 0 };
                }
                else if (previousSelection.location == "column") {
                    this.state.columns[previousSelection.column].pop();
                }
                else {
                    throw new Error("Unsupported selection location: " + selection.location);
                }
                // Add the card to it's new location
                if (selection.location == "freeCell") {
                    this.state.freeCells[selection.column] = card;
                }
                else if (selection.location == "column") {
                    this.state.columns[selection.column].push(card);
                }
                else if (selection.location == "foundation") {
                    this.state.foundations[selection.column].push(card);
                }
                else {
                    throw new Error("Unsupported selection location" + selection.location);
                }
                //Save results of selection to the local storage
                localStorage.setItem("state", JSON.stringify(this.state));
                // Start the next selection
                this.calculateStartOptions();
            }
        }
        else {
            // Clear selection and do a new start selection
            this.calculateStartOptions();
        }
    }
    setSelectionTypeForOptions(selectionType, options) {
        for (let option of options) {
            if (option.location === "freeCell") {
                this.state.freeCells[option.column].selectionType = selectionType;
            }
            else if (option.location === "foundation") {
                this.state.foundations[option.column][option.row].selectionType = selectionType;
            }
            else if (option.location === "column") {
                this.state.columns[option.column][option.row].selectionType = selectionType;
            }
        }
    }
    calculateStartOptions() {
        // Iterate through possible start options and see what can be selected
        // Setup autoFoundationOption
        let autoFoundationStart = undefined;
        let autoFoundationEnd = undefined;
        //freeCell
        let options = [];
        for (let i = 0; i < this.numFreeCells; i++) {
            let card = this.state.freeCells[i];
            if (card.value !== 0) {
                let selection = { location: "freeCell", column: i, row: 0 };
                let endOptions = this.calculateEndOptions(selection, true);
                if (endOptions.length > 0) {
                    options.push(selection);
                    card.selectionType = "end";
                    // Auto move cards to the foundation if appropriate
                    if (this.autoFoundations === true) {
                        for (let option of endOptions) {
                            if (option.location === "foundation") {
                                autoFoundationStart = selection;
                                autoFoundationEnd = option;
                            }
                        }
                    }
                }
            }
        }
        //columns
        for (let i = 0; i < this.numColumns; i++) {
            let lastIndex = this.state.columns[i].length - 1;
            let card = this.state.columns[i][lastIndex];
            if (card.value !== 0) {
                let endOptions = this.calculateEndOptions({ location: "column", column: i, row: lastIndex }, true);
                if (endOptions.length > 0) {
                    let selection = { location: "column", column: i, row: lastIndex };
                    options.push(selection);
                    card.selectionType = "end";
                    // Auto move cards to the foundation if appropriate
                    if (this.autoFoundations === true) {
                        for (let option of endOptions) {
                            if (option.location === "foundation") {
                                autoFoundationStart = selection;
                                autoFoundationEnd = option;
                            }
                        }
                    }
                }
            }
        }
        // set the current options
        this.selectionOptions = options;
        // Perform autoFoundationOption - automatically moves cards to the foundation
        if (this.autoFoundations === true && autoFoundationStart !== undefined && autoFoundationEnd !== undefined) {
            this.select(autoFoundationStart);
            this.select(autoFoundationEnd);
        }
    }
    calculateEndOptions(selection, truncateSearch = false) {
        // Calculate where the selected start card can end
        let card = this.getCardFromSelection(selection);
        // If trucateSearch is true; will return as soon as a single option found (saves time)
        let options = [];
        // Iterate through foundations
        for (let i = 0; i < 4; i++) {
            let lastIndex = this.state.foundations[i].length - 1;
            let foundationCard = this.state.foundations[i][lastIndex];
            if (isLower(card, foundationCard)) {
                options.push({ location: "foundation", column: i, row: lastIndex });
                if (truncateSearch) {
                    return options;
                }
            }
        }
        // Iterate through freeCells
        if (selection.location != "freeCell") {
            for (let i = 0; i < this.numFreeCells; i++) {
                let freeCell = this.state.freeCells[i];
                if (freeCell.value === 0) {
                    options.push({ location: "freeCell", column: i, row: 0 });
                    if (truncateSearch) {
                        return options;
                    }
                }
            }
        }
        // Iterate through columns
        for (let i = 0; i < this.numColumns; i++) {
            let lastIndex = this.state.columns[i].length - 1;
            let columnCard = this.state.columns[i][lastIndex];
            if (isHigher(card, columnCard) || columnCard.value === 0) {
                options.push({ location: "column", column: i, row: lastIndex });
                if (truncateSearch) {
                    return options;
                }
            }
        }
        // Return the options
        return options;
    }
    stringifyGameState() {
        let stringGameState = [...this.state.freeCells].sort((a, b) => {
            //-1 left item should be before right, 0 sort equally, 1 sorted after
            // Sort by value then suit 
            let aNumber = a.value * 1000 + a.suit;
            let bNumber = b.value * 1000 + b.suit;
            return bNumber - aNumber; //high to low sort
        }).map((card) => stringifyCard(card)).join("") +
            " | " +
            [...this.state.foundations].map((column) => column.map((card) => stringifyCard(card)).join("")).join(",") +
            " | " +
            [...this.state.columns].sort(
            // Sort by the top card in the stack   
            (a, b) => {
                let aNumber = a[a.length - 1].value * 1000 + a[a.length - 1].suit;
                let bNumber = b[b.length - 1].value * 1000 + b[b.length - 1].suit;
                return bNumber - aNumber; //high to low sort
            }).map((column) => column.map((card) => stringifyCard(card)).join("")).join(",");
        return stringGameState;
    }
    copy() {
        let copiedState = JSON.parse(JSON.stringify(this.state));
        let G = new Game(copiedState, this.numColumns, this.numFreeCells, this.hardColumns);
        if (this.selectionOptions) {
            G.selectionOptions = JSON.parse(JSON.stringify(this.selectionOptions));
        }
        if (this.currentSelection) {
            G.currentSelection = JSON.parse(JSON.stringify(this.currentSelection));
        }
        G.autoFoundations = this.autoFoundations;
        return G;
    }
    checkForWin() {
        //Check if the current position of the game is winning, by checking if no cards remain to be placed in the foundation
        for (let freeCell of this.state.freeCells) {
            if (freeCell.value == 0) {
                return false;
            }
        }
        for (let column of this.state.columns) {
            if (column.length > 1) {
                return false;
            }
        }
        return true;
    }
    checkForLoss() {
        // Check if the game is a loss by checking if there are any selection options
        return this.selectionOptions.length == 0;
    }
}
class VisualManager {
    constructor(main) {
        this.main = main;
    }
    drawGame(game) {
        //Create and draw the top area
        let topArea = getElementByClass(this.main, 'top-area');
        removeNodeChildren(topArea);
        // Find and bind refresh button
        let refreshButton = document.getElementById('refresh');
        refreshButton.onclick = () => {
            game.newGame();
            this.drawGame(game);
        };
        // Free Cells
        for (let i = 0; i < game.numFreeCells; i++) {
            let freeCell = document.createElement("div");
            topArea.appendChild(freeCell);
            freeCell.classList.add("free-cell");
            let card = game.state.freeCells[i];
            let f = () => {
                // onclick function for the card
                game.select({ location: "freeCell", column: i, row: 0 });
                this.drawGame(game);
            };
            this.createCard(freeCell, card, true, f);
        }
        // Foundations
        for (let i = 0; i < game.numFreeCells; i++) {
            let foundation = document.createElement("div");
            topArea.appendChild(foundation);
            foundation.classList.add("foundation");
            let len = game.state.foundations[i].length;
            if (len > 0) {
                let card = game.state.foundations[i][len - 1];
                let f = () => {
                    // onclick function for the card
                    game.select({ location: "foundation", column: i, row: len - 1 });
                    this.drawGame(game);
                };
                this.createCard(foundation, card, true, f);
            }
        }
        // Columns
        let columnArea = getElementByClass(this.main, 'column-area');
        removeNodeChildren(columnArea);
        for (let i = 0; i < game.numColumns; i++) {
            let column = document.createElement("div");
            columnArea.appendChild(column);
            column.classList.add("column");
            for (let j = 0; j < game.state.columns[i].length; j++) {
                let card = game.state.columns[i][j];
                let fullCard = (j == game.state.columns[i].length - 1);
                let f = () => {
                    // onclick function for the card
                    game.select({ location: "column", column: i, row: j });
                    this.drawGame(game);
                };
                this.createCard(column, card, fullCard, f);
            }
        }
    }
    createCard(area, cardObject, fullCard, onclick = function () { }) {
        // Unpack card information
        let value = cardObject.value;
        let suit = cardObject.suit;
        // Gather template
        let templateArea = document.getElementById('template-area');
        let cardTemplate = templateArea.getElementsByClassName("playing-card-layout-box")[0];
        let card = cardTemplate.cloneNode(true);
        if (fullCard == false) {
            card.classList.add("playing-card-layout-box-partial");
        }
        card.style.display = "block"; //Unhide template
        // Do highlight
        if (cardObject.selectionType == "start") {
            card.classList.add("card-start-highlight");
        }
        else if (cardObject.selectionType == "end") {
            card.classList.add("card-end-highlight");
        }
        // Update the value and the suit
        let valueString;
        if (value == 1) {
            valueString = "A";
        }
        else if (value <= 10) {
            valueString = value.toString();
        }
        else if (value == 11) {
            valueString = "J";
        }
        else if (value == 12) {
            valueString = "Q";
        }
        else if (value == 13) {
            valueString = "K";
        }
        else {
            throw new Error("Unexpected card value");
        }
        for (let textArea of card.getElementsByClassName("playing-card-value")) {
            textArea.textContent = valueString;
        }
        //Update the suit & color
        let suitString;
        let suitColor;
        if (suit == 0) {
            suitString = "■";
            suitColor = "green";
        }
        else if (suit == 1) {
            suitString = "♠";
            suitColor = "black";
        }
        else if (suit == 2) {
            suitString = "♦";
            suitColor = "red";
        }
        else if (suit == 3) {
            suitString = "♣";
            suitColor = "black";
        }
        else if (suit == 4) {
            suitString = "♥";
            suitColor = "red";
        }
        else {
            throw new Error("Unexpected card suit");
        }
        for (let suitArea of card.getElementsByClassName("playing-card-suit")) {
            suitArea.textContent = suitString;
            card.style.color = suitColor;
        }
        // Add the onclick event
        card.onclick = function (event) { onclick(); };
        area.appendChild(card);
        // Return the card for adding an onclick event
        return card;
    }
}
let vm = new VisualManager(document.getElementById('main'));
let loadState = localStorage.getItem("state");
let game;
if (true && loadState !== null) {
    game = new Game(JSON.parse(loadState));
}
else {
    game = new Game();
}
vm.drawGame(game);
/*
// SECTION FOR ATTEMPRITNG TO FIGURE OUT AN EFFICIENT WAY TO MOVE CARDS AS A STACK

function moveCard(fromColumn:Array<SelectionOption>, toColumn: Array<SelectionOption>): [SelectionOption, SelectionOption] {
    // Modifies the from and the to column in place
    let lastFrom = fromColumn.pop();
    if (lastFrom === undefined) {
        throw new Error("Not expecting empty column");
    }
    let lastTo = toColumn[toColumn.length - 1];
    if (lastTo === undefined) {
        throw new Error("Not expecting empty column");
    }
    toColumn.push({location: lastTo.location, column: lastTo.column, row: lastTo.row + 1});
    return [lastFrom, lastTo]
}

// Max move stack:
// simple move: openCells + open columns + 1
// secondary move = openCells + open columns < restack; then on the second section openCells + openColumns - 1 + 1
function recursiveStack(cards: Array<SelectionOption>, targetCard: SelectionOption, freeCells: Array<SelectionOption>, freeColumns: Array<SelectionOption>, targetColumnEmpty: boolean) {
    // Card selection from high to low
    // freeCells
    // freeColumns
    let moves: Array<[SelectionOption, SelectionOption]> = []
    let target: Array<SelectionOption> = []
    let allFree = freeCells.concat(freeColumns)
    if (cards.length <= allFree.length + 1) {
        // Play all the cards to piles
        let i = -1
        while (cards.length > 1) {
            i++
            let card = cards.pop()
            if (card === undefined) { throw new Error("Unexpected empty cards list") }
            moves.push([card, allFree[i]])
        }
        // Put the final card in the target
        let card = cards.pop()
        if (card === undefined) { throw new Error("Unexpected empty cards list") }
        moves.push([card, targetCard])
        targetCard = {location: targetCard.location, column: targetCard.column, row: targetCard.row + 1}
        // Move the rest of the cards back to the target
        while (i  >= 0) {
            moves.push([moves[i][1], targetCard])
            targetCard = {location: targetCard.location, column: targetCard.column, row: targetCard.row + 1}
            i--
        }
    }
    return moves
}

let numCards = 4
let numFreeCells = 2
let numFreeColumns = 3

let cards: Array<SelectionOption> = []
for (let i = 0; i < numCards; i++) {
    cards.push({location: "column", column: 0, row: i+1})
}
let targetCard: SelectionOption = {location: "column", column: 1, row: 0}
let freeCells: Array<SelectionOption> = []
for (let i = 0; i < numFreeCells; i++) {
    freeCells.push({location: "freeCell", column: i, row: 0})
}
let freeColumns: Array<SelectionOption> = []
for (let i = 2; i < numFreeColumns + 2; i++) {
    freeColumns.push({location: "column", column: i, row: 0})
}

let x = recursiveStack(cards, targetCard, freeCells, freeColumns, false)

*/
function bruteSolver(game, scorecard, lookup, winningScorecard) {
    //Returns a winningScoreCard if a better solution (or any solution is found)
    //Otherwise returns false
    //Use a branching algorythm with a lookup table to solve via a pretty brute force algorythm
    //Planned inprovements:
    // Stack moving improvement
    // Single card in foundation storage rules (stop moving back and forth)
    //
    //Check if the game is won
    if (game.checkForWin()) {
        // Add to the lookup as a win condition
        console.log("Found winning scorecard", scorecard);
        if (scorecard.steps < winningScorecard.steps) {
            // Replace the winning scorecard
            winningScorecard = scorecard;
        }
        return winningScorecard;
    }
    if (game.checkForLoss()) {
        console.log("Found losing scorecard", scorecard);
        return winningScorecard;
    }
    //Check if self is in the bruteSolver
    let gameString = game.stringifyGameState();
    if (gameString in lookup) {
        // Test if this is a more efficient solution
        if (scorecard.steps < lookup[gameString].steps) {
            lookup[gameString] = scorecard;
            //More efficiant, continue looking
        }
        else {
            // Less efficient, stop looking
            return winningScorecard;
        }
    }
    else {
        //Gamestring not encountered before
        console.log(scorecard.steps, "gameString", gameString);
        lookup[gameString] = scorecard;
        // vm.drawGame(game)
    }
    //Iterate through the next scorecard options
    for (let intermediarySelectionOption of game.selectionOptions) {
        //Select from location
        let intermediaryGame = game.copy();
        intermediaryGame.select(intermediarySelectionOption);
        for (let selectionOption of intermediaryGame.selectionOptions) {
            //Select too location
            let newGame = intermediaryGame.copy();
            newGame.select(selectionOption);
            let newActionList = [...scorecard.actionList];
            newActionList.push(selectionOption);
            let newScorecard = {
                state: game.state,
                steps: scorecard.steps + 1,
                actionList: newActionList
            };
            let returnScorecard = bruteSolver(newGame, newScorecard, lookup, winningScorecard);
            // set winning scorecard
            if (returnScorecard.steps < winningScorecard.steps) {
                winningScorecard = returnScorecard;
            }
        }
    }
    // Return overall winning or losing scorecard
    return winningScorecard;
}
// let startingScorecard: Scorecard = { state: game.state, steps: 0, actionList: [] }
// let winningScorecard: Scorecard = { state: game.state, steps: 10 ** 6, actionList: [] }
// let lookup: Record<string, Scorecard> = {}
// let resultScorecard = bruteSolver(game, startingScorecard, lookup, winningScorecard)
// console.log("RESULT")
// console.log(resultScorecard)
// vm.drawGame(game)
//# sourceMappingURL=main.js.map