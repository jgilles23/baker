"use strict";
//Control variable definitons
let infiniteSteps = 10 ** 6; //Define a depth for infinity for comparisons, big number
let defaultGameOptions = {
    numColumns: 8,
    numFreeCells: 4,
    hardColumns: false,
    autoFoundations: true
};
// const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
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
function getCardDivNode(card, parentDiv) {
    return parentDiv.querySelector("div[name='" + stringifyCard(card) + "']");
}
function getCardClientRect(card, parentDiv) {
    //Get the ClientRect for the specificed card within the specified parent Div element
    //If the card is not found, return: undefined
    let cardNode = getCardDivNode(card, parentDiv);
    if (cardNode) {
        return cardNode.getBoundingClientRect();
    }
    else {
        return undefined;
    }
}
class Game {
    constructor(options, state, selectionOptions, currentSelection) {
        //Game Class - for holding state of the game, any relevant options, and provides methods
        // for updating and changing the state of the game
        //Unpack options
        this.numColumns = options.numColumns;
        this.numFreeCells = options.numFreeCells;
        this.hardColumns = options.hardColumns;
        this.autoFoundations = options.autoFoundations;
        //Assign state
        this.state = state;
        //Assign selection Options & current selection
        this.selectionOptions = selectionOptions;
        this.currentSelection = currentSelection;
    }
    localStorageSaveState() {
        //TODO - move out of the game and into the visual manager
        localStorage.setItem("state", JSON.stringify(this.state));
    }
    getCardFromSelection(selection) {
        // retreive a Card object from the state given a SelectionOption object
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
        //Returns an array of cards, if a card was moved, the array is ordered in the order that the cards
        // are moved
        //Create the return array
        let animationFrames = [];
        // Start by clearing all selections already made
        let previousSelectionOptions = this.selectionOptions;
        this.setSelectionTypeForOptions("none", this.selectionOptions); //visually de-select all cards
        this.selectionOptions = []; //Reset selection options
        let previousSelection = this.currentSelection;
        if (this.currentSelection != undefined) {
            this.setSelectionTypeForOptions("none", [this.currentSelection]); //visually clear current selection
            this.currentSelection = undefined; //reset current selection
        }
        //Check if selection match any of the selection options
        if (isAnySelectionEqual(selection, previousSelectionOptions)) {
            if (previousSelection == undefined) {
                // Get the START - where a card is coming from
                let card = this.getCardFromSelection(selection);
                card.selectionType = "start";
                this.currentSelection = selection;
                this.selectionOptions = this.calculateEndOptions(selection);
                this.setSelectionTypeForOptions("end", this.selectionOptions);
                // Ensure that the selection shows up in the animation
                animationFrames.push({ movedCard: undefined, game: this.copy() });
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
                // Save the result into movedCards
                animationFrames.push({ movedCard: card, game: this.copy() });
                //Save results of selection to the local storage
                this.localStorageSaveState();
                // Start the next selection
                animationFrames.push(...this.calculateStartOptions());
            }
        }
        else {
            // Clear selection and do a new start selection
            animationFrames.push(...this.calculateStartOptions());
        }
        return animationFrames;
    }
    setSelectionTypeForOptions(selectionType, options) {
        //Update the selection type for each card in the current state
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
        //Setup a return for cards that were moved as part of the autofoundations flag
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
                    // Auto move cards to the foundation if appropriate, and autoFoundations is true
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
                //Calcualte options for the bottom card of the column
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
                //See if there is an oppertunity to move more of the stack
                let stackCheckFlag = true;
                let cardIndex = lastIndex - 1;
                let previousCard = card;
                while (stackCheckFlag && cardIndex > 0) {
                    let checkCard = this.state.columns[i][cardIndex];
                    if (isLower(checkCard, previousCard)) {
                        checkCard.selectionType = "debug";
                    }
                    else {
                        stackCheckFlag = false; //Did not match, end iteration
                    }
                    //Iterate
                    previousCard = checkCard;
                    cardIndex -= 1;
                }
            }
        }
        // set the current options
        this.selectionOptions = options;
        let animationFrames = [{ movedCard: undefined, game: this.copy() }];
        // Perform autoFoundationOption - automatically moves cards to the foundation
        if (this.autoFoundations === true && autoFoundationStart !== undefined && autoFoundationEnd !== undefined) {
            animationFrames.push(...this.select(autoFoundationStart)); //select start -- should not return a card
            animationFrames.push(...this.select(autoFoundationEnd)); //select end -- should return a card
        }
        //Return the moved cards in the correct order, first to last as moved
        return animationFrames;
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
    calculateStackEndOptions(selection, truncateSearch = false) {
        //Calculate where a stack of cards can move to
        // likely involves an iterative approach
        return []; // satisfy the return requirement while debugging
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
        return new GameFromGame(this);
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
class GameFromGame extends Game {
    constructor(parentGame) {
        super({
            numColumns: parentGame.numColumns,
            numFreeCells: parentGame.numFreeCells,
            hardColumns: parentGame.hardColumns,
            autoFoundations: parentGame.autoFoundations
        }, JSON.parse(JSON.stringify(parentGame.state)), //state
        JSON.parse(JSON.stringify(parentGame.selectionOptions)), //selectionOptions
        parentGame.currentSelection === undefined ?
            undefined : JSON.parse(JSON.stringify(parentGame.currentSelection)) //currentSelection
        );
    }
}
class GameFromState extends Game {
    constructor(state) {
        //Create a game from the state, use defualt options
        //MUST CALL calculateStartOptions if inital display of autofoundation is desired
        super({
            numColumns: state.columns.length,
            numFreeCells: state.freeCells.length,
            hardColumns: defaultGameOptions.hardColumns,
            autoFoundations: defaultGameOptions.autoFoundations
        }, JSON.parse(JSON.stringify(state)), //state
        [], //selectionOptions
        undefined //currentSelection
        );
    }
}
class RandomGame extends GameFromState {
    constructor() {
        //Randomize the game
        //Setup state
        let state = {
            freeCells: [],
            foundations: [],
            columns: [],
        };
        //Add empty cards and empty cells; Freecells, foundations, columns
        for (let i = 0; i < defaultGameOptions.numFreeCells; i++) {
            state.freeCells.push({ value: 0, suit: 0, selectionType: "none" });
        }
        for (let i = 0; i < 4; i++) {
            state.foundations.push([{ value: 0, suit: i + 1, selectionType: "none" }]);
        }
        for (let i = 0; i < defaultGameOptions.numColumns; i++) {
            state.columns.push([{ value: 0, suit: 0, selectionType: "none" }]);
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
            state.columns[col].push(card);
            col += 1;
            if (col == defaultGameOptions.numColumns) {
                col = 0;
            }
        }
        //Call super to define game from state
        super(state);
    }
}
class VisualManager {
    constructor(main) {
        this.main = main;
        this.animationFrames = [];
        this.drawingInProgressFlag = false;
    }
    drawGame(animationFrames) {
        //Process the animationFrames, leaving the last animation frame game as the display in the end
        this.animationFrames = animationFrames;
        this.processDrawGame();
    }
    processDrawGame() {
        //Draw the game presented, if showMove is defined, will animate the movement of
        // the array of cards from the previous position to the new positions
        //Pull the next frame out of the buffer and process 
        let animationFrame = this.animationFrames.shift();
        if (animationFrame === undefined) {
            return;
        }
        //Process inputs
        let game = animationFrame.game;
        let card = animationFrame.movedCard;
        let fromCardPositionRect;
        if (card !== undefined) {
            //Get previous positions of the cards
            fromCardPositionRect = getCardClientRect(card, this.main);
        }
        //Create and draw the top area
        let topArea = getElementByClass(this.main, 'top-area');
        removeNodeChildren(topArea);
        // Find and bind refresh button
        let refreshButton = document.getElementById('refresh');
        refreshButton.onclick = () => {
            let game = new RandomGame();
            let animationFrames = game.calculateStartOptions();
            this.drawGame(animationFrames);
        };
        // Free Cells
        for (let i = 0; i < game.numFreeCells; i++) {
            let freeCell = document.createElement("div");
            topArea.appendChild(freeCell);
            freeCell.classList.add("free-cell");
            let card = game.state.freeCells[i];
            let f = () => {
                // onclick function for the card
                let animationFrames = game.select({ location: "freeCell", column: i, row: 0 });
                this.drawGame(animationFrames);
            };
            this.createCard(freeCell, card, "full", f);
        }
        // Foundations -- display even covered cards (for animation purposes)
        for (let i = 0; i < game.numFreeCells; i++) {
            let foundation = document.createElement("div");
            topArea.appendChild(foundation);
            foundation.classList.add("foundation");
            let lastCardJ = game.state.foundations[i].length - 1;
            for (let j = 0; j < game.state.foundations[i].length; j++) {
                let card = game.state.foundations[i][j];
                let f = () => {
                    // onclick function for the card
                    let animationFrames = game.select({ location: "foundation", column: i, row: j });
                    this.drawGame(animationFrames);
                };
                this.createCard(foundation, card, "covered", f);
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
                let fullCard = (j == game.state.columns[i].length - 1) ? "full" : "partial";
                let f = () => {
                    // onclick function for the card
                    let animationFrames = game.select({ location: "column", column: i, row: j });
                    this.drawGame(animationFrames);
                };
                this.createCard(column, card, fullCard, f);
            }
        }
        // Calculate new positions of the cards & deltas between old and new positions
        //Iterate through each card that we would like to move,
        // assign to the animation class, define its offset in the x & y - position compute
        let animatedFlag = false;
        if (card !== undefined) {
            let cardNode = getCardDivNode(card, this.main);
            let toRect = getCardClientRect(card, this.main);
            let fromCard = fromCardPositionRect;
            if (fromCard !== undefined && toRect !== undefined && cardNode) {
                //If either is undefined, do not animate this card
                //Calcuate the translate values
                let deltaX = fromCard.x - toRect.x;
                let deltaY = fromCard.y - toRect.y;
                if (deltaX !== 0 || deltaY !== 0) {
                    cardNode.classList.add("animated-card");
                    cardNode.style.animation = "none";
                    cardNode.offsetHeight;
                    cardNode.style.animation = "";
                    cardNode.style.setProperty("--translateFromX", deltaX.toString() + "px");
                    cardNode.style.setProperty("--translateFromY", deltaY.toString() + "px");
                    //Mark the flag that we need to wait for the animation and setup animation completion action
                    animatedFlag = true;
                    cardNode.addEventListener("animationend", () => this.processDrawGame());
                }
            }
        }
        //Call self to process remaining frames
        if (animatedFlag === false) {
            // Not waiting for an animation to complete, immediatly call the next draw function
            this.processDrawGame();
        }
    }
    createCard(area, cardObject, cardDisplayStyle, onclick = function () { }) {
        // Unpack card information
        let value = cardObject.value;
        let suit = cardObject.suit;
        // Gather template
        let templateArea = document.getElementById('template-area');
        let cardTemplate = templateArea.getElementsByClassName("playing-card-layout-box")[0];
        let card = cardTemplate.cloneNode(true);
        if (cardDisplayStyle == "partial") {
            card.classList.add("playing-card-layout-box-partial");
        }
        else if (cardDisplayStyle == "covered") {
            card.classList.add("playing-card-layout-box-fully-covered");
        }
        card.style.display = "block"; //Unhide template
        // Do highlight
        if (cardObject.selectionType == "start") {
            card.classList.add("card-start-highlight");
        }
        else if (cardObject.selectionType == "end") {
            card.classList.add("card-end-highlight");
        }
        else if (cardObject.selectionType == "debug") {
            card.classList.add("card-debug-highlight");
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
        }
        //Color the card
        card.style.color = suitColor;
        // Name the card
        card.setAttribute("name", stringifyCard(cardObject));
        // Add the onclick event
        card.onclick = function () { onclick(); };
        area.appendChild(card);
        // Return the card for adding an onclick event
        return card;
    }
}
let VM = new VisualManager(document.getElementById('main'));
let loadState = localStorage.getItem("state");
let game;
let metaAnimationFrames;
if (true && loadState !== null) {
    game = new GameFromState(JSON.parse(loadState));
    metaAnimationFrames = game.calculateStartOptions();
}
else {
    game = new RandomGame();
    metaAnimationFrames = game.calculateStartOptions();
}
VM.drawGame(metaAnimationFrames);
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
    //Check if the path to victory is too long and should truncate
    if (winningScorecard.steps < infiniteSteps) {
        // Minimum remaining steps is the number of cards in the columns
        // Depending on settings may be +1 due to auto foundations, TODO
        let minRemainingSteps = game.state.columns.reduce((partialSum, column) => partialSum + column.length - 1, 0);
        if (scorecard.steps + minRemainingSteps >= winningScorecard.steps) {
            //impossible to complete in fewer steps than the found winning state, break
            console.log("Perfect play from this scorecard requires too many steps");
            return winningScorecard;
        }
    }
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
    //Check if the game is lost
    if (game.checkForLoss()) {
        //console.log("Found losing scorecard", scorecard)
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
// RUN SOLUTION SEARCH
if (false) { // eslint-disable-line
    let startingScorecard = { state: game.state, steps: 0, actionList: [] };
    let winningScorecard = { state: game.state, steps: infiniteSteps, actionList: [] };
    let lookup = {};
    let resultScorecard = bruteSolver(game, startingScorecard, lookup, winningScorecard);
    console.log("RESULT");
    console.log(resultScorecard);
}
class LocationSet {
    constructor(columns, freeCells) {
        //LocationSet, holds list of locations that cards can be moved to
        //Never modifiable, always returns a copy of self with modifications made
        //This will hopefully help to avoid errors
        this.columns = columns;
        this.freeCells = freeCells;
    }
    addColumn(column) {
        //Adds a column and returns a new LocationSet
        let newColumns = [...this.columns];
        newColumns.push(column);
        return new LocationSet(newColumns, this.freeCells);
    }
    removeColumn(column) {
        //Removes a column and returns a new LocationSet
        let newColumns = [...this.columns];
        if (newColumns.includes(column)) {
            newColumns.splice(newColumns.indexOf(column), 1);
        }
        return new LocationSet(newColumns, this.freeCells);
    }
    count(ignoreColumn) {
        //Counts the number of columns + freeCells in the LocationSet
        // removes ignoreColumn from the count if defined
        let c = this.columns.length + this.freeCells.length;
        if (ignoreColumn !== undefined && this.columns.includes(ignoreColumn)) {
            c--;
        }
        return c;
    }
    popFreeCellThenColumn() {
        //Returns a freeCell if avaliable, then a column, or undefined if neither avalaible
        if (this.freeCells.length > 0) {
            return [this.freeCells[0], new LocationSet(this.columns, this.freeCells.slice(1))];
        }
        else if (this.columns.length > 0) {
            return [this.columns[0], new LocationSet(this.columns.slice(1), this.freeCells)];
        }
        else {
            return [undefined, this];
        }
    }
    popColumn(ignoreColumn) {
        //Returns a column if abalible otherwise undefined
        //If ignoreColumn provided, will not return the specificed ignoreColumn
        if (this.columns.length > 0 && this.columns[0] !== ignoreColumn) {
            return [this.columns[0], new LocationSet(this.columns.slice(1), this.freeCells)];
        }
        else if (this.columns.length > 1) {
            //IgnoreColumn was the selected column, if there is another column, use that instead
            let newColumns = this.columns.slice(0, 1);
            newColumns.push(...this.columns.slice(2));
            return [this.columns[1], new LocationSet(newColumns, this.freeCells)];
        }
        else {
            return [undefined, this];
        }
    }
}
function stringifyNontrivilaLookupKey(numCards, openLocations, originOpenAfterMove) {
    return `cards:${numCards}, freeCell:${openLocations.freeCells.length}, column:${openLocations.columns.length}, originOpen:${originOpenAfterMove}`;
}
let nontrivialLookup = {};
function stackMove(cardStack, origin, startOpenLocations, destination, originOpenAfterMove, depth) {
    /*
    Function to return the sequence of moves that takes a stack of cards from origin to destination
     Uses the startOpenLocations to determine which locations are open for moves before starting
     and after completion
     cardStack: cards that need to be moved ordered from highest to lowest
    General form of non-trivial recursive move:
     Iterate though (i,j) integer partitions of cardStack
     Definitons:
      i: first section of cards to move, i > 0
      j: second section of cards to move, j > 0
      i + j = length of cardStack
      midpoint: column from "startOpenLocations" that is not the "destination"
     Algorithm:
      1) cardStack[j:] from "origin" using "startOpenLocations" -> "midpoint" leaving (secondOpenLocations: startOpenLocations - midpoint)
      2) cardStack[:j] from "origin" using "secondOpenLocations" -> "destination" leaving (thirdOpenLocations: secondOpenLocations + [origin if originOpenAfterMove])
      3) cardStack[j:] from "midpoint" using "thirdOpenLocations" -> "destination" leaving (endOpenLocations: thirdOpenLocations + midpoint)
    General form of the trivial move:
     trivial move applies when startOpenLocation.count() >= cardStack.length
     Algorithm:
      unpack cardStack[:-1] to freeCells then open columns exclusive of destination
      move cardStack[-1] to destination
      re-pack cardStack[:-1] in reverse order to destination
    Uses a lookup dictionary to avoid more calls than necessary to the non-trivial solution
    */
    //Setup the return
    let moveCommands = [];
    //TRIVIAL SOLUTION
    if (startOpenLocations.count(destination) >= cardStack.length - 1) {
        //Remove the destination from the open locations (if it exists), setup intermediate destinations
        let locations = startOpenLocations.removeColumn(destination);
        let intermDestination = undefined;
        //unpack
        for (let x = cardStack.length - 1; x > 0; x--) {
            [intermDestination, locations] = locations.popFreeCellThenColumn();
            if (intermDestination !== undefined) {
                moveCommands.push({ start: origin, end: intermDestination, card: cardStack[x] });
            }
            else {
                throw Error("Expected to have avalaible free cell or column");
            }
        }
        //move last card
        moveCommands.push({ start: origin, end: destination, card: cardStack[0] });
        //re-pack
        for (let x = cardStack.length - 2; x >= 0; x--) {
            moveCommands.push({ start: moveCommands[x].end, end: destination, card: moveCommands[x].card });
        }
        return moveCommands;
    }
    //NONTRIVIAL SOLUTION - funcationally in an "else" statement
    let bestMoveCommands = []; //Declare location to store the best move
    let bestMoveI = 0;
    //Gather list of possible i partition values
    let iOptionsArray;
    let lookupKey = stringifyNontrivilaLookupKey(cardStack.length, startOpenLocations, originOpenAfterMove);
    if (lookupKey in nontrivialLookup) {
        //This combination has been encountred before, only check the known best "i" value
        let iReturn = nontrivialLookup[lookupKey].i;
        if (iReturn === 0) {
            //Non-solvable
            return [];
        }
        else {
            iOptionsArray = [iReturn];
        }
    }
    else {
        //Case not encountered before, compute from all i values
        iOptionsArray = [];
        for (let i = 1; i <= cardStack.length - 1; i++) {
            iOptionsArray.push(i); //E.g. if length is 4, i is an element of [1,2,3]
        }
    }
    for (let i of iOptionsArray) {
        let j = cardStack.length - i;
        //Resursivly call stackMove to test if solution is valid
        let newMoveCommands = [];
        let returnedMoveCommands;
        //STEP 1, unpack
        let [midpoint, secondOpenLocations] = startOpenLocations.popColumn(destination); //destination and midpoint cannot be the same
        if (midpoint === undefined) {
            //No midpoint avaliable, only trivial solution is allowed
            continue;
        }
        returnedMoveCommands = stackMove(cardStack.slice(j), origin, startOpenLocations, midpoint, false, depth + 1);
        if (returnedMoveCommands.length === 0) {
            continue; //Move not possible
        }
        newMoveCommands.push(...returnedMoveCommands);
        //STEP 2, move
        returnedMoveCommands = stackMove(cardStack.slice(0, j), origin, secondOpenLocations, destination, originOpenAfterMove, depth + 1);
        if (returnedMoveCommands.length === 0) {
            continue; //Move not possible
        }
        newMoveCommands.push(...returnedMoveCommands);
        //STEP 3 re-pack
        let thirdOpenLocations = startOpenLocations.removeColumn(midpoint);
        thirdOpenLocations = thirdOpenLocations.removeColumn(destination);
        if (originOpenAfterMove) {
            //Add origin back to list of possible moves if nothing left there
            thirdOpenLocations = thirdOpenLocations.addColumn(origin);
        }
        returnedMoveCommands = stackMove(cardStack.slice(j), midpoint, thirdOpenLocations, destination, true, depth + 1);
        if (returnedMoveCommands.length === 0) {
            continue; //Move not possible
        }
        newMoveCommands.push(...returnedMoveCommands);
        //Check if this is the best solution found so far
        if (newMoveCommands.length < bestMoveCommands.length || bestMoveCommands.length === 0) {
            bestMoveCommands = newMoveCommands;
            bestMoveI = i;
        }
    }
    //Add or replace the best move found in the lookup dictionary
    if (bestMoveCommands.length === 0) {
        nontrivialLookup[lookupKey] = { i: 0, steps: 0 };
    }
    else {
        nontrivialLookup[lookupKey] = { i: bestMoveI, steps: bestMoveCommands.length };
    }
    return bestMoveCommands;
}
function testStackMove(options) {
    //Test function for stackMove
    console.log("Testing stackMove with options:", options);
    //Prepare and run the stackMove
    let baseOrigin = "A";
    let baseDestination = "B";
    let baseCardStack = [];
    for (let x = options.baseCardStackCount - 1; x >= 0; x--) {
        baseCardStack.push(x);
    }
    let baseOpenLocations = new LocationSet("CDEFGH".slice(0, options.baseOpenColumns).split(""), "abcd".slice(0, options.baseOpenFreeCells).split(""));
    if (options.baseDestinationOpen) {
        baseOpenLocations = baseOpenLocations.addColumn(baseDestination);
    }
    let baseMoveCommands = stackMove(baseCardStack, baseOrigin, baseOpenLocations, baseDestination, options.baseOriginOpenAfterMove, 0);
    console.log("  baseMoveCommands", baseMoveCommands);
    console.log("  nontrivialLookup number of keys:", Object.keys(nontrivialLookup).length);
}
let testStackMoveOptions1 = {
    baseCardStackCount: 10, //Must be > 0
    baseOpenColumns: 4, //Must be <= 6
    baseOpenFreeCells: 1, //Must be <= 4
    baseOriginOpenAfterMove: false,
    baseDestinationOpen: true
};
testStackMove(testStackMoveOptions1);
//# sourceMappingURL=main.js.map