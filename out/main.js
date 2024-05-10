"use strict";
//Control variable definitons
let infiniteSteps = 10 ** 6; //Define a depth for infinity for comparisons, big number
let foceFullStackMoveVisual = false; //If true, visualManager will force only full stack moves
let settings = {
    numColumns: 8, //Number of stack columns
    numFreeCells: 4, //Number of freeCells
    autoFoundations: true, //Automatically move cards to the foundation spaces
    fourColorMode: true, //Make cards easier to see by assigning 4 colors
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
    // TODO --- remove isHigher and isLower function calls entirely, they only return a compare anyway
    // Tests if the end card is one higher in value and the same suit as the start card
    return (endCard - startCard) === 1;
}
function isLower(startCard, endCard) {
    // Tests if the end card is one lower and the smae suit as the start card
    return (endCard - startCard) === -1;
}
function isSelectionEqual(selection0, selection1) {
    //Test if two selections are equal
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
    return "0A23456789TJQKabcdefgh"[card % 100] + "zsdch"[(card / 100) | 0];
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
function getSuit(card) {
    return (card / 100) | 0;
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
    indexOfColumnInArray(columnArray, column) {
        //Test if column is in columnList
        //If not, return -1, if yes return the index
        for (let i = 0; i < columnArray.length; i++) {
            let newColumnTest = typeof columnArray[i] == "string" ? undefined : columnArray[i];
            let columnTest = typeof column == "string" ? undefined : column;
            if (columnArray[i] == column || isSelectionEqual(newColumnTest, columnTest)) {
                return i;
            }
        }
        return -1;
    }
    removeColumn(column) {
        //Removes a column and returns a new LocationSet
        let newColumns = [...this.columns];
        let i = this.indexOfColumnInArray(newColumns, column);
        if (i > -1) {
            newColumns.splice(i, 1);
        }
        return new LocationSet(newColumns, this.freeCells);
    }
    count(ignoreColumn) {
        //Counts the number of columns + freeCells in the LocationSet
        // removes ignoreColumn from the count if defined
        let c = this.columns.length + this.freeCells.length;
        if (ignoreColumn !== undefined && this.indexOfColumnInArray(this.columns, ignoreColumn) > -1) {
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
        if (this.columns.length > 0 && ignoreColumn !== undefined && this.indexOfColumnInArray(this.columns, ignoreColumn) !== 0) {
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
class StackMover {
    constructor() {
        this.nontrivialLookup = {};
    }
    stringifyNontrivilaLookupKey(numCards, openLocations, originOpenAfterMove, destinationOpenBeforeMove) {
        return `cards:${numCards}, freeCell:${openLocations.freeCells.length}, column:${openLocations.columns.length}, originOpen:${originOpenAfterMove}, destinationOpen:${destinationOpenBeforeMove}`;
    }
    stackMoveFastCheck(cardStack, origin, startOpenLocations, destination, originOpenAfterMove, depth) {
        //Same as stackMove, but relies upon the lookup when possible
        //Returns ONLY if the stack move is possible, not the required MoveCommands
        //TRIVIAL - one card per stack solution
        if (startOpenLocations.count(destination) >= cardStack.length - 1) {
            return true;
        }
        //NON TRIVIAL SOLUTION
        let destinationOpenBeforeMove = startOpenLocations.indexOfColumnInArray(startOpenLocations.columns, destination) >= 0;
        let lookupKey = this.stringifyNontrivilaLookupKey(cardStack.length, startOpenLocations, originOpenAfterMove, destinationOpenBeforeMove);
        if (lookupKey in this.nontrivialLookup) {
            //This combination has been encountred before, only check the known best "i" value
            return this.nontrivialLookup[lookupKey].i > 0; //i is 0 when impossible, otherwise move is possible
        }
        else {
            //Case not encountered before, compute from all i values
            let fullMoves = this.stackMove(cardStack, origin, startOpenLocations, destination, originOpenAfterMove, depth);
            return fullMoves.length > 0; //Lenght 0 array, means not possible, if has length 
        }
    }
    stackMove(cardStack, origin, startOpenLocations, destination, originOpenAfterMove, depth) {
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
    
        TODO: implement unstack only option for the AI to use when stack required is enabled
        */
        //Setup the return
        let moveCommands = [];
        //TRIVIAL SOLUTION - move one card at a time to separate stacks
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
        let destinationOpenBeforeMove = startOpenLocations.indexOfColumnInArray(startOpenLocations.columns, destination) >= 0;
        let lookupKey = this.stringifyNontrivilaLookupKey(cardStack.length, startOpenLocations, originOpenAfterMove, destinationOpenBeforeMove);
        if (lookupKey in this.nontrivialLookup) {
            //This combination has been encountred before, only check the known best "i" value
            let iReturn = this.nontrivialLookup[lookupKey].i;
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
            returnedMoveCommands = this.stackMove(cardStack.slice(j), origin, startOpenLocations, midpoint, false, depth + 1);
            if (returnedMoveCommands.length === 0) {
                continue; //Move not possible
            }
            newMoveCommands.push(...returnedMoveCommands);
            //STEP 2, move
            returnedMoveCommands = this.stackMove(cardStack.slice(0, j), origin, secondOpenLocations, destination, originOpenAfterMove, depth + 1);
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
            returnedMoveCommands = this.stackMove(cardStack.slice(j), midpoint, thirdOpenLocations, destination, true, depth + 1);
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
            this.nontrivialLookup[lookupKey] = { i: 0, steps: 0 };
        }
        else {
            this.nontrivialLookup[lookupKey] = { i: bestMoveI, steps: bestMoveCommands.length };
        }
        return bestMoveCommands;
    }
    testStackMove(options) {
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
        let baseMoveCommands = this.stackMove(baseCardStack, baseOrigin, baseOpenLocations, baseDestination, options.baseOriginOpenAfterMove, 0);
        console.log("  baseMoveCommands", baseMoveCommands);
        console.log("  nontrivialLookup number of keys:", Object.keys(this.nontrivialLookup).length);
    }
}
class Game {
    constructor(state, selectionOptions, currentSelection) {
        //Game Class - for holding state of the game, any relevant options, and provides methods
        // for updating and changing the state of the game
        //Assign state
        this.state = state;
        //Assign selection Options & current selection
        this.selectionOptions = selectionOptions;
        this.currentSelection = currentSelection;
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
            return this.state.foundations[selection.column];
        }
        else if (selection.location == "column") {
            // column selection
            return this.state.columns[selection.column][selection.row];
        }
        else {
            throw new Error("Invalid selection location" + selection.location);
        }
    }
    clearSelection() {
        //Programatically clear the current selection
        this.selectionOptions = []; //Reset selection options
        if (this.currentSelection != undefined) {
            this.currentSelection = undefined; //reset current selection
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
        let previousSelection = this.currentSelection;
        this.clearSelection();
        //Check if selection match any of the selection options
        if (isAnySelectionEqual(selection, previousSelectionOptions)) {
            if (previousSelection == undefined) {
                // Get the START - where a card is coming from
                let card = this.getCardFromSelection(selection);
                this.currentSelection = selection;
                this.selectionOptions = this.calculateEndOptions(selection, false);
                // Ensure that the selection shows up in the animation
                animationFrames.push({ movedCard: undefined, game: this.copy() });
            }
            else {
                // SET THE END - where a card is going to
                let card = this.getCardFromSelection(previousSelection);
                //Check if the card is the head of a stack
                if (previousSelection.location == "column" && previousSelection.row < this.state.columns[previousSelection.column].length - 1) {
                    //Head of a row, calculate the movement required & perform the movement
                    let moveCommands = metaStackMover.stackMove(this.state.columns[previousSelection.column].slice(previousSelection.row), //cardStack
                    previousSelection, //origin
                    this.getOpenLocationSet(), //openLocationSet
                    { location: "column", column: selection.column, row: 0 }, //destination
                    previousSelection.row === 1, //originOpenAfterMove
                    0 //depth
                    );
                    //Clear selection to prepare for the next selection from moveCommands
                    this.clearSelection();
                    animationFrames.push(...this.calculateStartOptions());
                    //Make the moves & add the appropriate animationFrames
                    for (let command of moveCommands) {
                        //Assign a row to the selections if selection type is "column"
                        let startSelection = command.start;
                        if (startSelection.location == "column") {
                            startSelection.row = this.state.columns[startSelection.column].length - 1;
                        }
                        let endSelection = command.end;
                        if (endSelection.location == "column") {
                            endSelection.row = this.state.columns[endSelection.column].length - 1;
                        }
                        //Perform the moves --- TODO may fail if autoFoundations moves cards
                        // console.log("startSelection", startSelection, "selectionOptions", this.selectionOptions)
                        animationFrames.push(...this.select(startSelection));
                        // console.log("endSelection", endSelection, "selectionOptions", this.selectionOptions)
                        animationFrames.push(...this.select(endSelection));
                    }
                }
                else {
                    //Not the head of a row, do a normal movement
                    // Add a movement step to the state
                    this.state.depth += 1;
                    // remove the card from current location
                    if (previousSelection.location == "freeCell") {
                        this.state.freeCells[previousSelection.column] = 0;
                    }
                    else if (previousSelection.location == "column") {
                        this.state.columns[previousSelection.column] = this.state.columns[previousSelection.column].slice(0, -1); //Need to copy
                    }
                    else {
                        throw new Error("Unsupported selection location: " + selection.location);
                    }
                    // Add the card to it's new location
                    if (selection.location == "freeCell") {
                        this.state.freeCells[selection.column] = card;
                    }
                    else if (selection.location == "column") {
                        this.state.columns[selection.column] = [...this.state.columns[selection.column]]; //Copy
                        this.state.columns[selection.column].push(card);
                    }
                    else if (selection.location == "foundation") {
                        this.state.foundations[selection.column] = card;
                    }
                    else {
                        throw new Error("Unsupported selection location" + selection.location);
                    }
                    // Save the result into movedCards
                    animationFrames.push({ movedCard: card, game: this.copy() });
                    // Start the next selection
                    animationFrames.push(...this.calculateStartOptions());
                }
            }
        }
        else {
            // console.log("Invalid Selection", selection)
            // Clear selection and do a new start selection
            animationFrames.push(...this.calculateStartOptions());
        }
        return animationFrames;
    }
    calculateStartOptions() {
        // Iterate through possible start options and see what can be selected
        //Setup a return for cards that were moved as part of the autofoundations flag
        // Setup autoFoundationOption
        let autoFoundationStart = undefined;
        let autoFoundationEnd = undefined;
        //freeCell
        let options = [];
        for (let i = 0; i < settings.numFreeCells; i++) {
            let card = this.state.freeCells[i];
            if (card !== 0) {
                let selection = { location: "freeCell", column: i, row: 0 };
                let endOptions = this.calculateEndOptions(selection, true);
                if (endOptions.length > 0) {
                    options.push(selection);
                    // Auto move cards to the foundation if appropriate, and autoFoundations is true
                    if (settings.autoFoundations === true) {
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
        //Iterate through each column
        for (let i = 0; i < settings.numColumns; i++) {
            let lastIndex = this.state.columns[i].length - 1; //last index of the column
            let card = this.state.columns[i][lastIndex]; //last card of the column
            //Stop looking if the card Value is zero
            if (card == 0) {
                continue;
            }
            //Calcualte options for the bottom card of the column
            let endOptions = this.calculateEndOptions({ location: "column", column: i, row: lastIndex }, true);
            if (endOptions.length > 0) {
                let selection = { location: "column", column: i, row: lastIndex };
                options.push(selection);
                // Auto move cards to the foundation if appropriate
                if (settings.autoFoundations === true) {
                    for (let option of endOptions) {
                        if (option.location === "foundation") { //Only ever true once per option
                            autoFoundationStart = selection;
                            autoFoundationEnd = option;
                            break;
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
                    //Calculate end options for the cards
                    let stackHeadEndOptions = this.calculateEndOptions({ location: "column", column: i, row: cardIndex }, true);
                    if (stackHeadEndOptions.length > 0) {
                        options.push({ location: "column", column: i, row: cardIndex });
                    }
                }
                else {
                    stackCheckFlag = false; //Did not match, end iteration
                }
                //Iterate
                previousCard = checkCard;
                cardIndex -= 1;
            }
        }
        // set the current options
        this.selectionOptions = options;
        let animationFrames = [{ movedCard: undefined, game: this.copy() }];
        // Perform autoFoundationOption - automatically moves cards to the foundation
        if (settings.autoFoundations === true && autoFoundationStart !== undefined && autoFoundationEnd !== undefined) {
            animationFrames.push(...this.select(autoFoundationStart)); //select start -- should not return a card
            animationFrames.push(...this.select(autoFoundationEnd)); //select end -- should return a card
        }
        //Return the moved cards in the correct order, first to last as moved
        return animationFrames;
    }
    calculateEndOptions(selection, truncateSearch) {
        // Calculate where the selected start card can end
        // If trucateSearch is true; will return as soon as a single option found (saves time)
        let card = this.getCardFromSelection(selection);
        //Establishes if the card is the head of a stack, if yes, need to use stackMove
        let headOfStackFlag = (selection.location == "column") && (selection.row < this.state.columns[selection.column].length - 1);
        let options = [];
        // Iterate through foundations
        if (!headOfStackFlag) { //Stacks cannot be moved directly to foundations
            for (let i = 0; i < 4; i++) {
                let foundationCard = this.state.foundations[i];
                if (isLower(card, foundationCard)) {
                    options.push({ location: "foundation", column: i, row: 0 });
                    if (truncateSearch && !headOfStackFlag) {
                        return options;
                    }
                }
            }
        }
        //Iterate through freeCells; stacks cannot be moved directly to freeCells
        // Only first open freeCell is avaliable
        if (selection.location != "freeCell" && !headOfStackFlag) {
            for (let i = 0; i < settings.numFreeCells; i++) {
                let freeCell = this.state.freeCells[i];
                if (freeCell === 0) {
                    options.push({ location: "freeCell", column: i, row: 0 });
                    if (truncateSearch) {
                        return options;
                    }
                    break; //Successfully found freeCell, finish search
                }
            }
        }
        // Iterate through columns
        for (let i = 0; i < settings.numColumns; i++) {
            let lastIndex = this.state.columns[i].length - 1;
            let columnCard = this.state.columns[i][lastIndex];
            //Check if card is moving column top to column top, don't do that
            if (selection.location == "column" && selection.row === 1 && columnCard === 0) {
                continue;
            }
            if (isHigher(card, columnCard) || columnCard === 0) {
                //See if / how the stack can be moved
                if (headOfStackFlag) {
                    let canMoveStackFlag = metaStackMover.stackMoveFastCheck(//TODO,  make this faster by returning only the answer
                    this.state.columns[selection.column].slice(selection.row), //cardStack
                    selection, //origin
                    this.getOpenLocationSet(), //openLocationSet
                    { location: "column", column: i, row: 0 }, //destination
                    selection.row === 1, //originOpenAfterMove
                    0 //depth
                    );
                    //Move to next iteration if there is not a way to move to the location
                    if (canMoveStackFlag === false) {
                        continue;
                    }
                }
                //not the head of a stack of cards or headOfStack passed
                options.push({ location: "column", column: i, row: lastIndex });
                if (truncateSearch) {
                    return options;
                }
            }
        }
        // Return the options
        return options;
    }
    getOpenLocationSet() {
        //Return LocationSet of the freeCells and the columns that are currently open
        let openFreeCells = [];
        for (let i = 0; i < settings.numFreeCells; i++) {
            let freeCell = this.state.freeCells[i];
            if (freeCell === 0) {
                openFreeCells.push({ location: "freeCell", column: i, row: 0 });
            }
        }
        let openColumns = [];
        // Iterate through columns
        for (let i = 0; i < settings.numColumns; i++) {
            let lastIndex = this.state.columns[i].length - 1;
            let columnCard = this.state.columns[i][lastIndex];
            if (columnCard === 0) {
                openColumns.push({ location: "column", column: i, row: 0 });
            }
        }
        //Compose the LocationSet
        return new LocationSet(openColumns, openFreeCells);
    }
    stringifyGameState() {
        let stringGameState = [...this.state.freeCells].sort().map((card) => stringifyCard(card)).join("") +
            " | " +
            [...this.state.foundations].map((card) => stringifyCard(card)).join(",") +
            " | " +
            [...this.state.columns].sort(
            // Sort by the top card in the stack   
            (a, b) => {
                let aNumber = a[a.length - 1];
                let bNumber = b[b.length - 1];
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
            if (freeCell !== 0) {
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
    forceFullStackMove() {
        //Function to remove options that are not moving a full stack from the startOptions list
        if (this.currentSelection !== undefined) {
            //In the endOption state, do nothing
            return;
        }
        //Iterate through the selection Options
        for (let i = this.selectionOptions.length - 1; i >= 0; i--) {
            let selection = this.selectionOptions[i];
            if (selection.location == "column") {
                let card = this.getCardFromSelection(selection);
                let previousCard = this.getCardFromSelection({ location: "column", column: selection.column, row: selection.row - 1 });
                if (isHigher(card, previousCard)) {
                    //not the head of the stack remove this selectionOption & remove graphics
                    this.selectionOptions.splice(i, 1);
                }
            }
        }
    }
}
class GameFromGame extends Game {
    constructor(parentGame) {
        super({
            freeCells: [...parentGame.state.freeCells],
            foundations: [...parentGame.state.foundations],
            columns: [...parentGame.state.columns],
            depth: parentGame.state.depth
        }, //state
        [...parentGame.selectionOptions], //selectionOptions
        parentGame.currentSelection === undefined ?
            undefined : parentGame.currentSelection //currentSelection
        );
    }
}
class GameFromState extends Game {
    constructor(state) {
        //Create a game from the state, use defualt options
        //MUST CALL calculateStartOptions if inital display of autofoundation is desired
        super(JSON.parse(JSON.stringify(state)), //state
        [], //selectionOptions
        undefined //currentSelection
        );
        //Clear display
        this.clearSelection();
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
            depth: 0
        };
        //Add empty cards and empty cells; Freecells, foundations, columns
        for (let i = 0; i < settings.numFreeCells; i++) {
            state.freeCells.push(0);
        }
        for (let i = 1; i <= 4; i++) {
            state.foundations.push(i * 100);
        }
        for (let i = 0; i < settings.numColumns; i++) {
            state.columns.push([0]);
        }
        //Create a deck and shuffle it
        let deck = [];
        for (let i = 1; i <= 13; i++) {
            for (let j = 1; j <= 4; j++) {
                deck.push(100 * j + i);
            }
        }
        shuffleArray(deck);
        //Deal the cards
        let col = 0;
        for (let card of deck) {
            state.columns[col].push(card);
            col += 1;
            if (col == settings.numColumns) {
                col = 0;
            }
        }
        //Call super to define game from state
        super(state);
    }
}
class VisualManager {
    constructor(main) {
        this.localStorageStateLocation = "stateItems";
        this.storageStateMaxItems = 600;
        this.main = main;
        this.animationFrames = [];
        this.drawingInProgressFlag = false;
        this.displayedGame = undefined;
        //Load the local storage state if it exists
        this.storageStateAllItems = [];
        this.localStorageLoad(); //Grab from the localStorage
        this.storageLoadCurrent(); //Grab from the object storage
        if (this.storageStateAllItems.length == 0) {
            //Local storage load did not find a game to load, create a game
            this.newRandomGame();
        }
        //Setup buttons
        // Find and bind refresh button
        let refreshButton = document.getElementById('refresh');
        refreshButton.onclick = () => {
            this.newRandomGame();
        };
        // Find and bind the back button - load the most recent state
        let undoButton = document.getElementById("undo");
        undoButton.onclick = () => {
            this.storageLoadPrevious(undefined); //Load whatever was the previous state
        };
        //Find and bind the restart button - load the most recent new game state
        let restartButton = document.getElementById("restart");
        restartButton.onclick = () => {
            this.storageLoadPrevious("new");
        };
        //Find and bind the clear button - clears all of the localStorage
        let clearButton = document.getElementById("clear");
        clearButton.onclick = () => {
            this.localStorageClear();
        };
        //Find and bind the four color mode option
        let paintButton = document.getElementById("paintbrush");
        paintButton.onclick = () => {
            settings.fourColorMode = !settings.fourColorMode;
            this.drawGame([]);
        };
        // Find and bind the unpacker
        let unpackerButton = document.getElementById("unpack");
        unpackerButton.onclick = () => {
            if (this.displayedGame === undefined) {
                return;
            }
            let unpacker = new UnpackerFromState(this.displayedGame.state);
            let winningUnpacker = [];
            unpacker.step(winningUnpacker, {});
            console.log("Unpacker Iterations Run:", unpackerIterationsRun);
            console.log("Winning unpacker", winningUnpacker);
        };
    }
    newRandomGame() {
        let game = new RandomGame();
        let animationFrames = game.calculateStartOptions();
        this.storageSave(game, "new"); //Save as new type whats on
        this.drawGame(animationFrames);
    }
    localStorageLoad() {
        //Load items from the local storage, error handle
        let allItems = localStorage.getItem(this.localStorageStateLocation);
        if (allItems == null) {
            this.storageStateAllItems = [];
        }
        else {
            this.storageStateAllItems = JSON.parse(allItems);
        }
    }
    localStorageSave() {
        //Save items to the local storage
        localStorage.setItem(this.localStorageStateLocation, JSON.stringify(this.storageStateAllItems));
    }
    localStorageClear() {
        //Clear all items held in local storage
        localStorage.clear();
        //Start a new game
        this.newRandomGame();
    }
    storageSave(game, type) {
        let saveItem = {
            type: type,
            state: game.state,
            string: game.stringifyGameState()
        };
        //Test if the items has been saved before
        let lastItem = this.storageStateAllItems[this.storageStateAllItems.length - 1];
        if (lastItem === undefined || lastItem.string != saveItem.string) {
            //If there are too many items in storage remove one
            if (this.storageStateAllItems.length > this.storageStateMaxItems) {
                this.storageStateAllItems.shift();
            }
            //Add item to the storage
            this.storageStateAllItems.push(saveItem);
            //Actually save to the local storage
            this.localStorageSave();
        }
    }
    storageLoadCurrent() {
        if (this.storageStateAllItems.length > 0) {
            let loadedState = this.storageStateAllItems[this.storageStateAllItems.length - 1];
            let game = new GameFromState(loadedState.state);
            let animationFrames = game.calculateStartOptions();
            this.drawGame(animationFrames);
        }
    }
    storageLoadPrevious(type) {
        let loadedState = undefined;
        if (type === undefined) {
            loadedState = this.storageStateAllItems[this.storageStateAllItems.length - 2];
            if (loadedState !== undefined) {
                this.storageStateAllItems = this.storageStateAllItems.slice(0, -1);
            }
        }
        else {
            for (let i = this.storageStateAllItems.length - 2; i >= 0; i--) {
                if (this.storageStateAllItems[i].type == type) {
                    //found a loaded state that meets the criteria
                    loadedState = this.storageStateAllItems[i];
                    //Remove all subsequent states
                    this.storageStateAllItems = this.storageStateAllItems.slice(0, i + 1);
                    break;
                }
            }
        }
        if (loadedState === undefined) {
            //No state can be loaded, do nothing
        }
        else {
            //Load to the selected state & re-draw game
            this.localStorageSave();
            let game = new GameFromState(loadedState.state);
            let animationFrames = game.calculateStartOptions();
            this.drawGame(animationFrames);
        }
    }
    drawGame(animationFrames) {
        if (animationFrames.length === 0) {
            if (this.displayedGame === undefined) {
                return;
            }
            animationFrames = [{ movedCard: undefined, game: this.displayedGame }];
        }
        //Process the animationFrames, leaving the last animation frame game as the display in the end
        this.animationFrames = animationFrames;
        let finalGameAfterAnimation = animationFrames[animationFrames.length - 1].game;
        //Test function to only allow the player to perform fullStackMoves -- usually false
        if (foceFullStackMoveVisual) {
            finalGameAfterAnimation.forceFullStackMove();
        }
        this.processDrawGame();
        //Save to the local cache if appropriate
        this.storageSave(finalGameAfterAnimation, "step");
    }
    processDrawGame() {
        //Draw the game presented, if showMove is defined, will animate the movement of
        // the array of cards from the previous position to the new positions
        //Pull the next frame out of the buffer and process 
        let animationFrame = this.animationFrames.shift();
        if (animationFrame === undefined) {
            //There are no more animationFrames to display
            return;
        }
        //Process inputs
        let game = animationFrame.game;
        this.displayedGame = game;
        let card = animationFrame.movedCard;
        let fromCardPositionRect;
        if (card !== undefined) {
            //Get previous positions of the cards
            fromCardPositionRect = getCardClientRect(card, this.main);
        }
        //Display the number of steps encountered
        let stepsTakenDiv = document.getElementById("steps-taken");
        stepsTakenDiv.textContent = game.state.depth.toString();
        //Create and draw the top area
        let topArea = getElementByClass(this.main, 'top-area');
        removeNodeChildren(topArea);
        // Free Cells
        for (let i = 0; i < settings.numFreeCells; i++) {
            let freeCell = document.createElement("div");
            topArea.appendChild(freeCell);
            freeCell.classList.add("free-cell");
            let card = game.state.freeCells[i];
            let f = () => {
                // onclick function for the card
                let animationFrames = game.select({ location: "freeCell", column: i, row: 0 });
                this.drawGame(animationFrames);
            };
            this.createCard(freeCell, card, "full", f, this.calcCardSelectionType(game, { location: "freeCell", column: i, row: 0 }), "freeCell");
        }
        // Foundations -- display one covered cards (for animation purposes)
        for (let i = 0; i < settings.numFreeCells; i++) {
            let foundation = document.createElement("div");
            topArea.appendChild(foundation);
            foundation.classList.add("foundation");
            for (let j = -1; j <= 0; j++) {
                let card = game.state.foundations[i] + j;
                if (card % 100 == 99) {
                    continue;
                }
                let f = () => {
                    // onclick function for the card
                    let animationFrames = game.select({ location: "foundation", column: i, row: j });
                    this.drawGame(animationFrames);
                };
                this.createCard(foundation, card, "covered", f, this.calcCardSelectionType(game, { location: "foundation", column: i, row: j }), "foundation");
            }
        }
        // Columns
        let columnArea = getElementByClass(this.main, 'column-area');
        removeNodeChildren(columnArea);
        for (let i = 0; i < settings.numColumns; i++) { //columns
            let column = document.createElement("div");
            columnArea.appendChild(column);
            column.classList.add("column");
            for (let j = 0; j < game.state.columns[i].length; j++) { //rows of column
                let card = game.state.columns[i][j];
                let fullCard = (j == game.state.columns[i].length - 1) ? "full" : "partial";
                let f = () => {
                    // onclick function for the card
                    let animationFrames = game.select({ location: "column", column: i, row: j });
                    this.drawGame(animationFrames);
                };
                let type = this.calcCardSelectionType(game, { location: "column", column: i, row: j });
                if (game.state.columns[i].length === 1 && j === 0) {
                    this.createCard(column, card, fullCard, f, type, "column");
                }
                else if (j > 0) {
                    this.createCard(column, card, fullCard, f, type, "column");
                }
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
    calcCardSelectionType(game, selection) {
        if (isSelectionEqual(game.currentSelection, selection)) {
            return "start";
        }
        if (isAnySelectionEqual(selection, game.selectionOptions)) {
            return "end";
        }
        return "none";
    }
    createCard(area, cardObject, cardDisplayStyle, onclick = function () { }, selectionType, selectionLocation) {
        // Unpack card information
        let value = cardObject % 100;
        let suit = getSuit(cardObject);
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
        if (selectionType == "start") {
            card.classList.add("card-start-highlight");
        }
        else if (selectionType == "end") {
            card.classList.add("card-end-highlight");
        }
        else if (selectionType == "debug") {
            card.classList.add("card-debug-highlight");
        }
        // Update the value and the suit
        let valueString;
        if (value == 0 && selectionLocation !== "foundation") {
            valueString = "";
        }
        else if (value == 1) {
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
            suitString = ""; //"■";
            suitColor = "white";
        }
        else if (suit == 1) {
            suitString = "♠";
            suitColor = "black";
        }
        else if (suit == 2) {
            suitString = "♦";
            if (settings.fourColorMode) {
                suitColor = "blue";
            }
            else {
                suitColor = "red";
            }
        }
        else if (suit == 3) {
            suitString = "♣";
            if (settings.fourColorMode) {
                suitColor = "purple";
            }
            else {
                suitColor = "black";
            }
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
    easyDrawState(state) {
        let game = new GameFromState(state);
        this.drawGame([{ movedCard: undefined, game: game }]);
    }
    easyDrawGame(game) {
        this.drawGame([{ movedCard: undefined, game: game }]);
    }
}
class Solver {
    constructor(game) {
        //Class to use as a solver for a particular game
        // Sovles the game, but uses timeouts to ensure that we don't interfere with javascript execution
        // Uses a stack to store the next item that needs to be calculated and calculates a certian number of
        // iterations at a time, instead of waiting for full resolution
        this.lookup = {};
        this.winningSteps = infiniteSteps;
        this.winningPath = [];
        game.forceFullStackMove();
        this.startingGame = game;
        this.stack = [{
                game: game,
                remainingOptions: JSON.parse(JSON.stringify(game.selectionOptions)),
                selection: undefined
            }];
    }
    processItem() {
        //Look at the last item on the stack and process for a win or not
        let stackItem = this.stack[this.stack.length - 1];
        if (stackItem === undefined) {
            throw Error("Solve process item called when there are not items on the stack.");
        }
        //Check if there are more options to operate on
        if (stackItem.remainingOptions.length == 0) {
            this.stack.pop(); //Processing complete for this item
            return;
        }
        //Operation on the next game and the next Option in the stack
        let newGame = new GameFromGame(stackItem.game);
        stackItem.selection = stackItem.remainingOptions.shift();
        newGame.select(stackItem.selection);
        let newGameString = newGame.stringifyGameState();
        //Check if this was choosing the START CARD -- we only want to look at things after choosing the end card
        // otherwise the state is exactly the same from a stateString perspective
        if (newGame.currentSelection === undefined) {
            //Check if we have encountered this state before
            if (this.lookup[newGameString] !== undefined) {
                //Test if this is a more efficient solution
                if (newGame.state.depth < this.lookup[newGameString]) {
                    //More efficient soluton found
                    this.lookup[newGameString] = newGame.state.depth;
                }
                else {
                    //A more efficient game exists, stop looking
                    // console.log("Already in lookup")
                    return;
                }
            }
            else {
                //Not encountered before, add to the lookup
                this.lookup[newGameString] = newGame.state.depth;
            }
            //Check if winning or losing scorecard
            if (newGame.selectionOptions.length === 0) {
                //Option has never been selected and no Options in the stack
                if (newGame.checkForWin()) {
                    //Winning game, check for replacement
                    if (newGame.state.depth < this.winningSteps) {
                        //Found a better WINNING solution
                        this.winningSteps = newGame.state.depth;
                        this.winningPath = this.stack.map((item) => {
                            if (item.selection === undefined) {
                                throw Error("Not expecting undefined selection");
                            }
                            else {
                                return item.selection;
                            }
                        });
                        console.log("Found winning solution, steps: ", this.winningSteps);
                    }
                }
                else {
                    //Losing game
                    // console.log("Found losing game.")
                }
                return;
            }
            //Check if path to vistory is too long and should stop searching here
            if (this.winningSteps < infiniteSteps) {
                // Minimum remaining steps is the number of cards in the columns
                // Depending on settings may be +1 due to auto foundations, TODO
                let minRemainingSteps = newGame.state.columns.reduce((partialSum, column) => partialSum + column.length - 1, 0);
                if (newGame.state.depth + minRemainingSteps >= this.winningSteps) {
                    //impossible to complete in fewer steps than the found winning state, break
                    // console.log("Perfect play from this scorecard requires too many steps")
                    return;
                }
            }
        }
        //This newGame needs to be investigated further
        //Restrict to fullStackMoves only
        newGame.forceFullStackMove();
        this.stack.push({
            game: newGame,
            remainingOptions: JSON.parse(JSON.stringify(newGame.selectionOptions)),
            selection: undefined
        });
    }
    solveInline() {
        while (this.stack.length > 0) {
            this.processItem();
        }
    }
}
let unpackerIterationsRun = 0;
class Unpacker {
    constructor(columns, cardLookup, nextFoundationCards, blockedCards, nonFoundationSteps) {
        this.columns = columns;
        this.cardLookup = cardLookup;
        this.nextFoundationCards = nextFoundationCards;
        this.blockedCards = blockedCards;
        this.nonFoundationSteps = nonFoundationSteps;
    }
    countOpenCells() {
        //Calculate the number of open columns and open freeCells avalaible
        return this.columns.reduce((accu, column) => accu + (column.length === 0 ? 1 : 0), 0);
    }
    copy() {
        //Return a deep copy of the current Unpacker
        return new UnpackerFromUnpacker(this);
    }
    stringify() {
        //Stringify self 
        return this.columns.map(column => column.toString()).sort().toString();
    }
    step(winningUnpacker, lookup) {
        //Iterativly call this function to take the best step each time
        //Inputs:
        // winningUnpacker - Array of 0 or 1 item that indicates if unpacker is used or not
        // lookup - takes a string of an unpacker to see if this arrangement has been seen before
        //Return:
        // steps to get to the winning state -- in a format yet to be determined
        //Calculate the fewest possible remaining moves based on coverage properties of the unpacker
        let bestPossible = [...this.blockedCards].reduce((accu, card) => accu + this.cardLookup[card].countColumnBlocker, 0);
        console.log(" -".repeat(this.nonFoundationSteps), "best additional", bestPossible, this);
        if (winningUnpacker.length !== 0 && this.nonFoundationSteps + bestPossible >= winningUnpacker[0].nonFoundationSteps) {
            //Cannot do better than the solution already found, skip
            return;
        }
        //Record how many times this has been run
        unpackerIterationsRun += 1;
        let openCells = this.countOpenCells();
        //Iterate through the next card for each foundation and find it's depth
        let stepsToUncoverNextFoundationCard = [99, 99, 99, 99];
        for (let i = 0; i < this.nextFoundationCards.length; i++) {
            let cardi = this.nextFoundationCards[i];
            //Check if column is complete, if yes skip
            if (cardi % 100 > 13) {
                continue;
            }
            //Check if higher in a column than another foundation card, if yes, skip this card
            let lookupi = this.cardLookup[cardi];
            let skipi = false;
            for (let j = i + 1; j < this.nextFoundationCards.length; j++) {
                let nextFoundationCardj = this.nextFoundationCards[j];
                if (nextFoundationCardj % 100 > 13) {
                    //Foundation already complete for this suit, skip
                    continue;
                }
                let lookupj = this.cardLookup[nextFoundationCardj];
                if (lookupi.column === lookupj.column && lookupi.row < lookupj.row) {
                    skipi = true;
                    break;
                }
            }
            if (skipi) {
                continue;
            }
            //Fill with the number of free cells that will need to be filled by the move if passed
            let countCardsToMove = this.columns[lookupi.column].length - lookupi.row - 1;
            if (countCardsToMove > openCells) {
                //There are ont enough open cells to move that many cards
                stepsToUncoverNextFoundationCard[i] = 99;
            }
            else {
                stepsToUncoverNextFoundationCard[i] = countCardsToMove;
            }
        }
        console.log("steps", stepsToUncoverNextFoundationCard);
        let sortedSteps = stepsToUncoverNextFoundationCard.map((v, i) => [v, i]).sort((a, b) => a[0] - b[0]);
        for (let [countCardsToUncover, i] of sortedSteps) {
            if (countCardsToUncover >= 99) {
                //Stop checking when reaching un-useable numbers
                break;
            }
            //Create a copy
            let childUnpacker = this.copy();
            //Uncover cards
            let nextFoundationCard = childUnpacker.nextFoundationCards[i];
            let nextFoundationCardData = childUnpacker.cardLookup[nextFoundationCard];
            let cardsToMove = childUnpacker.columns[nextFoundationCardData.column].slice(nextFoundationCardData.row + 1);
            childUnpacker.moveCards(cardsToMove);
            //Perform any required foundation moves
            let winningFlag = childUnpacker.foundationMove(); //TODO, this should not need to be called again
            if (winningFlag) {
                //Test if better than previous winning solutions
                if (winningUnpacker.length === 0 || childUnpacker.nonFoundationSteps < winningUnpacker[0].nonFoundationSteps) {
                    console.log("BEST YET", childUnpacker);
                    winningUnpacker[0] = childUnpacker;
                }
            }
            else {
                // Test if this unpacker has been found before
                let childString = childUnpacker.stringify();
                if (!(childString in lookup) || childUnpacker.nonFoundationSteps < lookup[childString]) {
                    //Update the lookup
                    lookup[childString] = childUnpacker.nonFoundationSteps;
                    // Run the next iteration
                    childUnpacker.step(winningUnpacker, lookup);
                }
            }
        }
    }
    moveCards(cards) {
        //Move the specificed cards in order to open spots
        // Probable error if there are not enough open spots
        let columnIndex = 0;
        for (let card of cards) {
            //Cards should never be moved to foundation while uncovering, because that would be caught earlier
            //Need to move the card to an openCell
            //Find and empty column
            while (this.columns[columnIndex].length > 0) {
                columnIndex++;
                if (columnIndex >= this.columns.length) {
                    throw Error("Expecting to have a place to move cards to.");
                }
            }
            //Actually move the card
            this.nonFoundationSteps += 1;
            this.columns[this.cardLookup[card].column].pop();
            this.columns[columnIndex].push(card);
            let cardData = this.cardLookup[card];
            cardData.column = columnIndex;
            cardData.row = 0;
            //If was blocking a card, need remove the block
            if (cardData.cardBlocked !== undefined) {
                let blockedCardData = this.cardLookup[cardData.cardBlocked];
                blockedCardData.countColumnBlocker -= 1;
                //Remove from set of blocked cards if all the blocking cards have been removed
                if (blockedCardData.countColumnBlocker <= 0) {
                    this.blockedCards.delete(cardData.cardBlocked);
                }
                //Actually remove the reference to the blocked card
                cardData.cardBlocked = undefined;
            }
        }
    }
    foundationMove() {
        //Move any avaliable cards to the foundations
        //Returns true if the game is in a winning state after the foundation moves, otherwise false
        let testingSuit = 0;
        let testUnitlSuit = 0;
        while (true) {
            //Try to move a card from the foundation
            let card = this.nextFoundationCards[testingSuit];
            //Test if winning on this suit & skip
            if (card % 100 > 13) {
                //Suit is winning
                testingSuit = (testingSuit + 1) % 4;
                if (testingSuit === testUnitlSuit) {
                    break;
                }
                continue;
            }
            let cardData = this.cardLookup[card];
            if (this.columns[cardData.column].length - 1 === cardData.row) {
                //At the bottom of the column --- put in the foundation
                this.columns[cardData.column].pop();
                this.nextFoundationCards[testingSuit] += 1;
                testUnitlSuit = testingSuit;
                //Test to ensure that a card moved to a foundation is not blocking anything
                if (cardData.cardBlocked !== undefined) {
                    throw Error("Card moved to foundation should never be blocking.");
                }
            }
            else {
                //Card of this suit cannot be moved
                testingSuit = (testingSuit + 1) % 4;
                if (testingSuit === testUnitlSuit) {
                    break;
                }
            }
        }
        //Test if winning
        for (let card of this.nextFoundationCards) {
            if (card % 100 < 14) {
                return false;
            }
        }
        return true;
    }
}
class UnpackerFromState extends Unpacker {
    constructor(state) {
        //Solver the looks only at unpacking piles
        // Applies heuristics to find a best possible unpacking strategy given the state
        // 1) Create a lookup network
        // 2) Calculate "self stacks" -- where higher numbers in a suit cover lover numbers
        // 3) Calculate the "optimum" path
        // 4) Find least unpacks for each suit (ignoring suits that have a child unpack first)
        // If we ever find a solution that matches the optimum we can stop
        // If we ever exceed the number of open cells, we can stop
        //
        //Setup the objects
        super(state.columns.map(column => column.slice(1)), //Columns from the state
        {}, // cardLookup
        [], //nextFoundationCards
        new Set(), //blockedCards
        0 //nonFoundationSteps
        );
        //Finish filling out the columns
        this.columns.push(...state.freeCells.map(card => card === 0 ? [] : [card]));
        //Add a bunch of extra open cells for testing purposes TODO
        for (let i = 0; i < 20; i++) {
            this.columns.push([]);
        }
        //Iterate through columns
        for (let i = 0; i < this.columns.length; i++) {
            let lowestPerSuit = [0, 0, 0, 0]; //Array of 4 cards, spade...
            for (let j = 0; j < this.columns[i].length; j++) {
                let card = this.columns[i][j];
                let currentSuitLowestCard = lowestPerSuit[getSuit(card) - 1];
                //Check if any blocking is happening
                if (currentSuitLowestCard === 0 || currentSuitLowestCard > card) {
                    // Card is the new lowest of the suit in the category
                    lowestPerSuit[getSuit(card) - 1] = card;
                    this.cardLookup[card] = {
                        column: i,
                        row: j,
                        countColumnBlocker: 0,
                        cardBlocked: undefined
                    };
                }
                else if (currentSuitLowestCard < card) {
                    // This card is blocking the previous lowest
                    this.cardLookup[card] = {
                        column: i,
                        row: j,
                        countColumnBlocker: 0,
                        cardBlocked: currentSuitLowestCard
                    };
                    // The lowerCard is being blocked, it's lookup needs to be updated & added to the blocked cards list (if not already there)
                    this.cardLookup[currentSuitLowestCard].countColumnBlocker++;
                    this.blockedCards.add(currentSuitLowestCard);
                }
                else {
                    throw Error("Not expecting to find a card that is neither higher nor lower");
                }
            }
        }
        //Iterate through freeCells
        for (let i = 0; i < state.freeCells.length; i++) {
            let card = state.freeCells[i];
            this.cardLookup[card] = {
                column: i + state.columns.length,
                row: 0,
                countColumnBlocker: 0,
                cardBlocked: undefined
            };
        }
        //Iterate through the foundations to set the next foundation card
        for (let foundationCard of state.foundations) {
            this.nextFoundationCards.push(foundationCard + 1);
        }
    }
}
class UnpackerFromUnpacker extends Unpacker {
    constructor(unpacker) {
        super(unpacker.columns.map(column => [...column]), //columns
        JSON.parse(JSON.stringify(unpacker.cardLookup)), //cardLookup
        [...unpacker.nextFoundationCards], //nextFoundationCards
        new Set(unpacker.blockedCards), //blockedCards
        unpacker.nonFoundationSteps);
    }
}
let metaStackMover = new StackMover();
let VM = new VisualManager(document.getElementById('main'));
if (VM.displayedGame === undefined) {
    throw Error("VM needs to be defined.");
}
let solver = new Solver(new GameFromGame(VM.displayedGame));
let playButton = document.getElementById("play");
let wrapper = () => {
    for (let i = 0; i < 3000; i++) {
        if (solver.stack.length > 0) {
            solver.processItem();
        }
    }
    let lastItem = solver.stack[solver.stack.length - 1];
    let solverStatus = document.getElementById("solver-status");
    if (lastItem === undefined) {
        console.log("SOLUTION:", solver.winningSteps, solver.winningPath);
        if (solver.winningSteps === infiniteSteps) {
            //Losing
            solverStatus.innerText = "No solutions found.";
        }
        else {
            //Winning solution
            solverStatus.innerText = `Solution found in ${solver.winningSteps} steps.`;
            //Bind buttons to the solution
            //Progress two clicks
            let nextStep = document.getElementById("next-solver");
            let currentStepIndex = 0;
            nextStep.onclick = () => {
                // onclick function for the card
                if (VM.displayedGame === undefined) {
                    throw Error("VM needs to be defined.");
                }
                let animationFrames = VM.displayedGame.select(solver.winningPath[currentStepIndex]);
                animationFrames.push(...VM.displayedGame.select(solver.winningPath[currentStepIndex + 1]));
                VM.drawGame(animationFrames);
                currentStepIndex += 2;
            };
            //Progress all the clicks
            let runAllSteps = document.getElementById("all-solver");
            runAllSteps.onclick = () => {
                if (VM.displayedGame === undefined) {
                    throw Error("VM needs to be defined.");
                }
                let animationFrames = [];
                for (let step of solver.winningPath) {
                    animationFrames.push(...VM.displayedGame.select(step));
                }
                VM.drawGame(animationFrames);
            };
            return;
        }
    }
    else {
        // Probably not solved, update the status bar
        if (solver.winningSteps === infiniteSteps) {
            solverStatus.innerText = "Solver running...";
        }
        else {
            solverStatus.innerText = `Running... Found ${solver.winningSteps} step solution.`;
        }
    }
    // VM.easyDrawGame(lastItem.game)
    setTimeout(wrapper, 0);
};
playButton.onclick = () => {
    console.log("RUNNING 2nd SOLVER");
    metaStackMover = new StackMover(); //Reset the stack mover
    if (VM.displayedGame === undefined) {
        throw Error("VM needs to be defined.");
    }
    solver = new Solver(new GameFromGame(VM.displayedGame)); //reset solver
    wrapper();
};
let R = {
    empty: 0,
    column: 16,
    freecell: 32,
    foundation: 48,
    suitShift: 4,
    suitMask: 48, //b110000
    valueMask: 15, //b001111
    infinity: 10000
};
class LightGame {
    constructor(parents, columns, freecells, steps, countBlockers, countRemainingCards, lookup, winningSteps) {
        this.parents = parents;
        this.columns = columns;
        this.freecells = freecells;
        this.steps = steps; //Counted when removing from
        this.countBlockers = countBlockers;
        this.countRemainingCards = countRemainingCards; //Changed when adding to foundation
        this.moves = [];
        this.bestChild = undefined;
        this.bestSteps = R.infinity;
        this.lookup = lookup;
        this.winningSteps = winningSteps;
    }
    copy() {
        return new LightGame([...this.parents], [...this.columns], [...this.freecells], this.steps, this.countBlockers, this.countRemainingCards, this.lookup, this.winningSteps);
    }
    isBlocker(card) {
        let parent = this.parents[card];
        //Iterate up the line of parents to see if there are any blocking cards
        while (parent & R.valueMask) { //Parent does not have value of 0
            if ((parent & R.suitMask) === (card & R.suitMask) && parent < card) {
                return true;
            }
            parent = this.parents[parent];
        }
        return false;
    }
    calcPerfectSteps() {
        return this.steps + this.countBlockers + this.countRemainingCards;
    }
    checkWinning() {
        if (this.countRemainingCards === 0) {
            this.bestSteps = this.steps;
            return true;
        }
        return false;
    }
    stringify() {
        return JSON.stringify(this.parents);
    }
    print() {
        //Headers
        let s = "";
        s += "Parents: ";
        for (let i = 0; i < 16; i++) {
            s += this.printCard(i)[0] + "- ";
        }
        s += "\n";
        //Values by suit
        for (let suit = 0; suit < 4; suit++) {
            s += `     -${"sdch"[suit]}: `;
            for (let i = 0; i < 16; i++) {
                s += this.printCard(this.parents[suit * 16 + i]) + " ";
            }
            s += "\n";
        }
        //Other Info
        s += "Columns Free: " + this.columns.map(card => this.printCard(card)).join(", ") + "\n";
        s += "Freecells   : " + this.freecells.map(card => this.printCard(card)).join(", ") + "\n";
        //Create readable foundations
        let foundationStrings = [];
        for (let suit = 0; suit < 4; suit++) {
            let card = (suit << R.suitShift) + 1;
            while (this.parents[card] === R.foundation) {
                card += 1;
            }
            foundationStrings.push(this.printCard(card - 1, true));
        }
        s += "Foundations : " + foundationStrings.join(", ") + '\n';
        //Create readable columns
        try {
            let classicColumns = [];
            for (let card of this.columns) {
                let A = [];
                while (card !== R.column) {
                    A.push(this.printCard(card));
                    card = this.parents[card];
                }
                classicColumns.push(A.join(","));
            }
            s += `Columns (${this.columns.length}) : ` + classicColumns.join(" | ") + "\n";
        }
        catch {
            s += "Columns: ERROR \n";
        }
        //Statistics like info
        s += `Steps: ${this.steps}, Blockers: ${this.countBlockers}, Remaining: ${this.countRemainingCards}, Perfect: ${this.calcPerfectSteps()}`;
        return s;
    }
    printCard(card, allowZero = false) {
        //Return two character representation of card
        if (card < 0 || card >= 64) {
            return ">?";
        }
        else if ((card & R.valueMask) === 0) {
            if (allowZero) {
                return "0" + "sdch"[card >> R.suitShift];
            }
            else {
                return ["**", "*C", "*E", "*F"][card >> R.suitShift];
            }
        }
        else if ((card & R.valueMask) === 14) {
            return "<D"; //Foundation done
        }
        else if ((card & R.valueMask) > 14) {
            return "<?";
        }
        else {
            return "?A23456789TJQK"[card & R.valueMask] + "sdch"[card >> R.suitShift];
        }
    }
    isNextToFoundation(card) {
        return this.parents[card - 1] === R.foundation && this.parents[card] !== R.foundation;
    }
    //Implement solving functions
    step() {
        //Take a solution step
        // 1) Order by column fitness, then:
        //    Perform freecell move
        //    Perform empty column move ---- breaks "unpack" mode if it makes it past here
        //    Perform move onto higher column
        // 2) Iterate through freecells
        //    Perform move onto higher column
        //    Perform move onto empty column
        //Return: number of steps to get to a winning state, return 0 if there is no wining state reached
        // console.log(this.steps, this)
        if (this.steps > 200) {
            throw "Too deep";
        }
        //1) Move columns by fitness
        let columnFitness = this.columns.map(card => this.calcColumnFitness(card));
        let orderedColumns = this.columns.map((_, i) => i).sort((a, b) => this.columns[b] - this.columns[a]);
        //Test column moves
        for (let column of orderedColumns) {
            let card = this.columns[column];
            //freecell move
            if (this.freecells.length < 4) {
                this.applyMove(card, column, -1); //column > freecell
            }
            //empty column move
            if (this.columns.length < 8) {
                this.applyMove(card, column, R.infinity); //column > empty column
            }
            //move to another column
            let targetColumn = this.columns.indexOf(card + 1);
            if (targetColumn !== -1) {
                this.applyMove(card, column, targetColumn); //column > column
            }
        }
        //2) Test freecell moves
        for (let i = 0; i < this.freecells.length; i++) {
            //move onto higher column
            let card = this.freecells[i];
            let targetColumn = this.columns.indexOf(card + 1);
            if (targetColumn !== -1) {
                this.applyMove(card, -1, targetColumn); //freecell > column
            }
            //move onto empty column
            if (this.columns.length < 8) {
                this.applyMove(card, -1, R.infinity); //column > empty column
            }
        }
    }
    applyMove(card, sourceColumn, destinationColumn) {
        //Inputs:
        // sourceCard: card to be moved
        // sourceColumn: 
        //   (0-7) column to removed the card from
        //   (-1) remove card from freeCell
        // desinationColumn:
        //   (0-7) non-empty column to add the card to
        //   (R.infinity) add the card to emptyColumn
        //   (-1) add the card to freecell
        //   (-2) add the card to foundation
        //Create a copy of this LightGame, apply the move function
        // Test if winning >> makes it bestChild: TODO: break out of the higher level testing loop
        // Test if state has been found before >> if better than before continue, else RETURN
        //  if state has not been found before >> save into the lookup
        // Go to next step
        // Test if a winner has been found at the bottom, if yes, replace best move
        let nextGame = this.copy();
        //Remove card, add the card, check the column if appropriate
        if (sourceColumn === -1) {
            nextGame.removeFromFreeCell(card);
        }
        else {
            nextGame.removeFromColumn(card, sourceColumn);
        }
        //Add card to the proper location, parsed by the destination column
        if (destinationColumn === -2) {
            nextGame.addToFoundation(card);
        }
        else if (destinationColumn === -1) {
            nextGame.addToFreeCell(card);
        }
        else if (destinationColumn === R.infinity) {
            nextGame.addToColumnEmpty(card);
        }
        else {
            nextGame.addToColumnCard(card, destinationColumn);
        }
        //Check for a column remove if the column is either empty or needs to be moved to the foundation
        if (sourceColumn >= 0) {
            nextGame.checkColumn(sourceColumn);
        }
        //Check if a card was moved to the foundation, if yes, check the next foundation
        if (destinationColumn === -2) {
            nextGame.checkFoundation(card + 1);
        }
        //Cleanup the columns, removing empty columns
        let columnToRemove = nextGame.columns.indexOf(R.column);
        while (columnToRemove >= 0) {
            nextGame.columns.splice(columnToRemove, 1);
            columnToRemove = nextGame.columns.indexOf(R.column);
        }
        nextGame.inspectState();
        //Check if the game is winning after the move
        if (nextGame.checkWinning()) {
            //Check if winning
            console.log("FOUND WINNING", nextGame.bestSteps);
            this.bestSteps = nextGame.bestSteps;
            this.bestChild = nextGame;
            return;
        }
        //Check if the game state has been reached before
        let nextGameString = nextGame.stringify();
        if (nextGameString in this.lookup) {
            if (nextGame.steps >= this.lookup[nextGameString]) {
                return;
            }
            this.lookup[nextGameString] = nextGame.steps;
        }
        else {
            this.lookup[nextGameString] = nextGame.steps;
        }
        //Operate next step on the nextGame
        nextGame.step();
        nextGame.inspectState();
        //Save as the best child, if it is the best
        if (nextGame.bestSteps < this.bestSteps) {
            this.bestSteps = nextGame.bestSteps;
            this.bestChild = nextGame;
        }
    }
    removeFromColumn(card, column) {
        this.steps += 1;
        this.countBlockers -= +this.isBlocker(card);
        // this.parents[card] = R.empty
        this.columns[column] = this.parents[card];
    }
    removeFromFreeCell(card) {
        this.steps += 1;
        // this.parents[card] = R.empty
        this.freecells.splice(this.freecells.indexOf(card), 1);
    }
    addToColumnCard(card, column) {
        this.moves.push({ card: card, target: "C", targetCard: this.columns[column] });
        this.parents[card] = this.columns[column];
        this.columns[column] = card;
        this.countBlockers += +this.isBlocker(card);
    }
    addToColumnEmpty(card) {
        this.moves.push({ card: card, target: "C", targetCard: 0 });
        this.parents[card] = R.column;
        this.columns.push(card);
    }
    addToFreeCell(card) {
        this.moves.push({ card: card, target: "E", targetCard: 0 });
        this.parents[card] = R.freecell;
        this.freecells.push(card);
    }
    addToFoundation(card) {
        this.moves.push({ card: card, target: "F", targetCard: 0 });
        this.parents[card] = R.foundation;
        this.countRemainingCards -= 1;
    }
    checkColumn(column) {
        //To be called after a remove/add pair that exposes a new card in a column
        // Check if that new card can be moved to the foundation
        if (this.columns[column] === R.column) {
            return;
        }
        let nextCard = this.columns[column];
        if (this.parents[nextCard - 1] === R.foundation) {
            this.removeFromColumn(nextCard, column);
            this.addToFoundation(nextCard);
            this.checkColumn(column);
            this.checkFoundation(nextCard + 1);
        }
    }
    checkFoundation(card) {
        //Check if a card should be moved to the foundation, if yes, perform the move to the foundation
        if (card > 13 || this.parents[card] === R.foundation) {
            return;
        }
        //Check if move from freecell
        if (this.parents[card] === R.freecell) {
            this.removeFromFreeCell(card);
            this.addToFoundation(card);
            this.checkFoundation(card + 1);
            return;
        }
        //Check if card in a column and can be moved 
        let sourceColumn = this.columns.indexOf(card);
        if (sourceColumn >= 0) {
            this.removeFromColumn(card, sourceColumn);
            this.addToFoundation(card);
            this.checkColumn(sourceColumn);
            this.checkFoundation(card + 1);
        }
    }
    calcColumnFitness(card) {
        //Function to calculate the fitness of a column for unpacking the column from the most exposed card
        // Lower number is more fit
        // 1 point per card that is covering the next card to go to a foundation
        // 100 points per card that is not covering next card to go to the foundation
        let fitness = 0;
        while (card !== undefined && card !== R.column) {
            if (this.parents[card] === R.foundation) {
                throw "Unexpected next card";
            }
            //Test if the card is the next card to be put into a foundation
            if (this.isNextToFoundation(card)) {
                return fitness / 100 | 0;
            }
            //Else add to the fitness
            fitness += 100;
            card = this.parents[card];
        }
        return fitness;
    }
    inspectState() {
        //Throws an Exception if an error is found with the state of the game, to try and find what's going on
        //Check columns
        if (this.columns.length > 8) {
            throw "Too many columns";
        }
        for (let column = 0; column < this.columns.length; column++) {
            let card = this.columns[column];
            if (this.isNonCard(card)) {
                throw "Error in columns contents";
            }
            while (card !== R.column) {
                if (this.isNonCard(card)) {
                    throw "Error in columnn trace";
                }
                card = this.parents[card];
            }
        }
        //Check freeCells
        if (this.freecells.length > 4) {
            throw "Too many freeCells";
        }
        for (let freecell = 0; freecell < this.freecells.length; freecell++) {
            let card = this.freecells[freecell];
            if (this.isNonCard(card)) {
                throw "Non card in freecell";
            }
            if (this.parents[card] !== R.freecell) {
                throw "Freecell parent does not point to freecell";
            }
        }
        //Check across for foundations & value 0 is foundation & value 14/15 is empty
        for (let suit = 0; suit < 4; suit++) {
            //value 0 should be foundation
            if (this.parents[suit << R.suitShift] !== R.foundation) {
                throw "zero value parent is not foundation";
            }
            //if parent is foundation, previous parent should be foundation; check that cards reference valid things
            let prevousParent = this.parents[suit << R.suitShift];
            for (let value = 1; value <= 13; value++) {
                let card = (suit << R.suitShift) + value;
                if (this.isNonCard(card) && !(card === R.foundation || card === R.freecell || card === R.column)) {
                    throw "card has unexpected parent";
                }
                let parent = this.parents[card];
                if (parent === R.foundation && prevousParent !== R.foundation) {
                    throw "card in foundation without parent in foundation";
                }
            }
            //vlaue 14/15 should always be empty
            for (let value = 14; value < 16; value++) {
                let card = (suit << R.suitShift) + value;
                if (this.parents[card] !== R.empty) {
                    throw "value 14/15 has unexpected parent";
                }
            }
        }
        //Check blockers
        let checkBlockers = 0;
        let checkRemainingCards = 0;
        for (let suit = 0; suit < 4; suit++) {
            for (let value = 1; value <= 13; value++) {
                let card = (suit << R.suitShift) + value;
                checkBlockers += +this.isBlocker(card);
                if (this.parents[card] !== R.foundation) {
                    checkRemainingCards += 1;
                }
            }
        }
        if (checkBlockers !== this.countBlockers) {
            throw "incorrect countBlockers";
        }
        if (checkRemainingCards !== this.countRemainingCards) {
            throw "incorrect countRemainingCards";
        }
    }
    isNonCard(card) {
        //Test if the card is a card or some other value
        return ((card < 0) || (card >= 64) || ((card & R.valueMask) < 1) || ((card & R.valueMask) > 13));
    }
}
class LightGameFromGame extends LightGame {
    constructor(game) {
        super(Array(64).fill(0), //parents
        [], //columns
        [], //freeCells
        game.state.depth, 0, //countBlockers
        0, //countRemainingCards
        {}, //Lookup
        [R.infinity]);
        //Iterate through columns
        for (let column of game.state.columns) {
            let parent = R.column;
            for (let unconvertedCard of column.slice(1)) {
                let card = this.convertCardToLightCard(unconvertedCard);
                if (card % 100 === 0) {
                    continue;
                }
                this.parents[card] = parent;
                this.countBlockers += +this.isBlocker(card);
                this.countRemainingCards += 1;
                parent = card;
            }
            //Append the most revealed card
            if (parent !== R.column) {
                this.columns.push(parent);
            }
        }
        //Iterate through freeCells
        for (let card of game.state.freeCells) {
            if (card % 100 !== 0) {
                card = this.convertCardToLightCard(card);
                this.parents[card] = R.freecell;
                this.countRemainingCards += 1;
                this.freecells.push(card);
            }
        }
        //Iterate through foundations
        for (let card of game.state.foundations) {
            card = this.convertCardToLightCard(card);
            //Mark all cards that are in the foundation
            for (let i = card & R.suitMask; i <= card; i++) {
                this.parents[i] = R.foundation;
            }
        }
    }
    convertCardToLightCard(card) {
        return (getSuit(card) - 1) * 16 + (card % 100);
    }
}
class StackMoverLight {
    constructor() {
        this.stackMoveLookup = {}; //I think this will cause the lookup to be shared across Classes
    }
    stackMove(stackSize, openColumns, openFreecells, addedColumnsAfter, addedFreecellsAfter, destinationType, unpackOnlyFlag) {
        //Apply the function devised in Sheet5 of Book4
        //Inputs:
        // stackSize: numnber of cards that need to be moved; will always interpret lowest card as 0
        // openColumns - the number of columns that are empty and can be filled with anything
        // openFreeCells - number of open freecells
        // addedColumnsAfter -- number of columns that become empty after removing the base card
        // addedFreecellsAfter -- nummber of freecells that become empty after removing the base card
        // destination type -- 
        //  empty: move onto one of the empty openColumns
        //  card: move onto the higher card that is already in a column
        //  unpackOnly: do not re-stack after the move, bias towards emptycolumns
        // unpackOnlyFlag -- if true, will only perform the unpack step & will skip the re-pack step
        //Return: StackMoveLookupItem
        //Check if an answer is in the lookup
        let lookupString = `${stackSize}: C${openColumns} E${openFreecells} +C${addedColumnsAfter} +E${addedFreecellsAfter}, D(${destinationType})`;
        if (lookupString in this.stackMoveLookup) {
            return this.stackMoveLookup[lookupString];
        }
        console.log(lookupString);
        //Base rejection cases
        if (destinationType === "empty" && openColumns === 0) {
            return false;
        }
        else if (destinationType === "freecell" && openFreecells === 0) {
            return false;
        }
        else if (destinationType === "freecell" && unpackOnlyFlag !== true) {
            throw "If destination is freecell, must be unpackOnly case";
        }
        //create a moves object
        let moves = [];
        //Check if this is a trivial move, if yes, complete the trivial move
        if (stackSize <= openColumns + openFreecells + +(destinationType === "card" || destinationType === "freecell")) {
            let card = 0;
            let steps = 0;
            let freecellCount = 0;
            //Add cards to the freecells first; exclude the final card
            while (freecellCount < openFreecells && card < (stackSize - 1)) {
                moves.push([card, "freecell"]);
                steps++;
                card++;
                freecellCount++;
            }
            let columnCount = 0;
            //Add cards to the columns next
            while (card < (stackSize - 1)) {
                moves.push([card, "empty"]);
                steps++;
                card++;
                columnCount++;
            }
            //Put the highest card in the correct location
            moves.push([card, destinationType]);
            steps++;
            //If not an unpack move, move cards on top of the unpacked card
            if (!unpackOnlyFlag) {
                for (let card = stackSize - 2; card >= 0; card--) {
                    moves.push([card, "card"]);
                    steps++;
                }
            }
            //Save to the lookup table for future use 
            let stackMoveLookupItem = {
                steps: steps,
                moves: moves
            };
            this.stackMoveLookup[lookupString] = stackMoveLookupItem;
            return stackMoveLookupItem;
        }
        //Solution was not the simple solution, need to split into potentially more complicated solutions
        let minimumSteps = R.infinity;
        let minimumStackSizeA = R.infinity;
        let minimumStackAMove;
        let minimumStackBMove;
        let minimumStackAToBMove; //Not applicable in unpack mode
        //Split into an A & B stack: 1) move A, 2) move B, 3) move A onto B
        for (let stackSizeA = 1; stackSizeA < stackSize - 1; stackSizeA++) {
            let steps = 0;
            let stackSizeB = stackSize - stackSizeA;
            //Move A onto a column
            let returnStackAMove = this.stackMove(stackSizeA, //stackSize
            openColumns, //openColumns
            openFreecells, //openFreecells
            0, //addedColumnsAfter
            0, //addedFreecellsAfter
            "empty", //destinationType
            false);
            if (returnStackAMove === false) {
                continue;
            }
            else {
                steps += returnStackAMove.steps;
            }
            //Move or unpack B
            let returnStackBMove = this.stackMove(stackSizeB, //stackSize
            openColumns - 1, //openColumns
            openFreecells, //openFreecells
            addedColumnsAfter, //addedColumnsAfter
            addedFreecellsAfter, //addedFreecellsAfter
            destinationType, //destinationType
            unpackOnlyFlag);
            if (returnStackBMove === false) {
                continue;
            }
            else {
                steps += returnStackBMove.steps;
            }
            //Move A onto B or ignore if not repacking
            let returnStackAToBMove = undefined;
            if (!unpackOnlyFlag) {
                //repack
                returnStackAToBMove = this.stackMove(stackSizeA, //stackSize
                openColumns - 1 + addedColumnsAfter + (destinationType === "empty" ? -1 : 0), //openColumns
                openFreecells + addedFreecellsAfter, //openFreecells
                1, //addedColumnsAfter
                0, //addedFreecellsAfter
                "card", //destinationType
                false);
                if (returnStackAToBMove === false) {
                    continue;
                }
                else {
                    steps += returnStackAToBMove.steps;
                }
            }
            //If we made it to here it means we passed all the steps, now we check if this is the best path
            if (steps < minimumSteps) {
                minimumSteps = steps;
                minimumStackSizeA = stackSizeA;
                minimumStackAMove = returnStackAMove;
                minimumStackBMove = returnStackBMove;
                minimumStackAToBMove = returnStackAToBMove;
            }
        }
        //Check if a solution was found
        if (minimumSteps === R.infinity) {
            this.stackMoveLookup[lookupString] = false;
            return false;
        }
        //A solution was found, update the moves, B stack numbering needs to be updated
        if (minimumStackAMove !== undefined) {
            moves.push(...minimumStackAMove.moves);
        }
        if (minimumStackBMove !== undefined) {
            for (let m of minimumStackBMove.moves) {
                moves.push([m[0] + minimumStackSizeA, m[1]]);
            }
        }
        if (minimumStackAToBMove !== undefined) {
            moves.push(...minimumStackAToBMove.moves);
        }
        //Save to the lookup and return
        let stackMoveLookupItem = {
            steps: minimumSteps,
            moves: moves
        };
        this.stackMoveLookup[lookupString] = stackMoveLookupItem;
        return stackMoveLookupItem;
    }
}
function light() {
    if (VM.displayedGame !== undefined) {
        let q = new LightGameFromGame(VM.displayedGame);
        console.log(q);
        console.log(q.print());
        q.step();
        return q;
    }
    else {
        console.log("undefined Game");
        return undefined;
    }
}
// let q = light()
let w = new StackMoverLight();
//# sourceMappingURL=main.js.map