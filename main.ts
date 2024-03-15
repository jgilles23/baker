//Control variable definitons
let infiniteSteps = 10 ** 6 //Define a depth for infinity for comparisons, big number
let defaultGameOptions: GameOptions = {
    numColumns: 8,
    numFreeCells: 4,
    hardColumns: false,
    autoFoundations: true
}

type SelectionType = "none" | "start" | "end"

interface Card {
    value: number; //0 for placeholder, otherwise 1 for Ace to 13 for King
    suit: number; //0 for placeholder, otherwise 1: spades, 2: diamonds, 3: clubs, 4: hearts
    selectionType: SelectionType;
}

interface GameState {
    freeCells: Array<Card>;
    foundations: Array<Array<Card>>;
    columns: Array<Array<Card>>;
}

interface SelectionOption {
    location: "column" | "freeCell" | "foundation"
    column: number
    row: number
}

interface Scorecard {
    state: GameState //State contained by the scorecard --- may be redundant with dictionary key
    steps: number //Count the number of steps to the current state
    actionList: Array<SelectionOption> //List of actions taken to get to current scorecard
    //Action 0 is the first action taken to get to current state d
}

interface GameOptions {
    numColumns: number;
    numFreeCells: number;
    hardColumns: boolean;
    autoFoundations: boolean;
}

type CardDisplayStyle = "full" | "partial" | "covered"

// const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

function getElementByClass(parentDiv: HTMLDivElement, className: string): HTMLDivElement {
    let children = parentDiv.getElementsByClassName(className);
    if (children.length == 0) {
        throw new Error('Could not find element with class:' + className + ' in ' + parentDiv);
    }
    return children[0] as HTMLDivElement;
}

function shuffleArray(array: Array<unknown>): void {
    // Fisher–Yates shuffle of an array in place
    for (let i = array.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [array[i], array[j]] = [array[j], array[i]];
    }
}

function removeNodeChildren(node: HTMLDivElement) {
    while (node.children.length > 0) {
        node.removeChild(node.children[0]);
    }
}

function isHigher(startCard: Card, endCard: Card): boolean {
    // Tests if the end card is one higher in value and the same suit as the start card
    return (startCard.suit === endCard.suit) && (startCard.value + 1 === endCard.value)
}

function isLower(startCard: Card, endCard: Card): boolean {
    return (startCard.suit === endCard.suit) && (startCard.value - 1 === endCard.value)
}

function isSelectionEqual(selection0: SelectionOption | undefined, selection1: SelectionOption | undefined): boolean {
    if (selection0 == undefined || selection1 == undefined) {
        return false
    }
    return (selection0.location === selection1.location && selection0.column === selection1.column && selection0.row === selection1.row)
}

function isAnySelectionEqual(selection: SelectionOption, options: Array<SelectionOption>): boolean {
    for (let option of options) {
        if (isSelectionEqual(selection, option)) {
            return true
        }
    }
    return false
}

function stringifyCard(card: Card): string {
    return "0A23456789TJQKabcdefgh"[card.value] + "zsdch"[card.suit]
}

function getCardDivNode(card: Card, parentDiv: HTMLDivElement): HTMLDivElement | null {
    return parentDiv.querySelector("div[name='" + stringifyCard(card) + "']")
}

function getCardClientRect(card: Card, parentDiv: HTMLDivElement): DOMRect | undefined {
    //Get the ClientRect for the specificed card within the specified parent Div element
    //If the card is not found, return: undefined
    let cardNode = getCardDivNode(card, parentDiv)
    if (cardNode) {
        return cardNode.getBoundingClientRect()
    } else {
        return undefined
    }
}



class Game implements GameOptions {
    //GameOptions
    numColumns: number;
    numFreeCells: number;
    hardColumns: boolean;
    autoFoundations: boolean;
    //Other attributes
    state: GameState;
    selectionOptions: Array<SelectionOption>;
    currentSelection: SelectionOption | undefined;

    constructor(options: GameOptions, state: GameState,
        selectionOptions: Array<SelectionOption>, currentSelection: SelectionOption | undefined) {
        //Game Class - for holding state of the game, any relevant options, and provides methods
        // for updating and changing the state of the game
        //Unpack options
        this.numColumns = options.numColumns
        this.numFreeCells = options.numFreeCells
        this.hardColumns = options.hardColumns
        this.autoFoundations = options.autoFoundations
        //Assign state
        this.state = state
        //Assign selection Options & current selection
        this.selectionOptions = selectionOptions
        this.currentSelection = currentSelection
    }

    localStorageSaveState() {
        //TODO - move out of the game and into the visual manager
        localStorage.setItem("state", JSON.stringify(this.state))
    }

    getCardFromSelection(selection: SelectionOption): Card {
        // retreive a Card object from the state given a SelectionOption object
        // freeCell
        if (selection.location === "freeCell") {
            // freeCell selection
            return this.state.freeCells[selection.column]
        } else if (selection.location === "foundation") {
            // foundation selection
            return this.state.foundations[selection.column][selection.row]
        } else if (selection.location == "column") {
            // column selection
            return this.state.columns[selection.column][selection.row]
        } else {
            throw new Error("Invalid selection location" + selection.location)
        }
    }

    select(selection: SelectionOption): Array<Card> {
        // performs appropriate actions when a selection is made
        //Returns an array of cards, if a card was moved, the array is ordered in the order that the cards
        // are moved
        //Create the return array
        let movedCards: Array<Card> = []
        // Start by clearing all selections already made
        let previousSelectionOptions = this.selectionOptions
        this.setSelectionTypeForOptions("none", this.selectionOptions) //visually de-select all cards
        this.selectionOptions = [] //Reset selection options
        let previousSelection = this.currentSelection
        if (this.currentSelection != undefined) {
            this.setSelectionTypeForOptions("none", [this.currentSelection]) //visually clear current selection
            this.currentSelection = undefined //reset current selection
        }
        //Check if selection match any of the selection options
        if (isAnySelectionEqual(selection, previousSelectionOptions)) {
            if (previousSelection == undefined) {
                // Get the START - where a card is coming from
                let card = this.getCardFromSelection(selection);
                card.selectionType = "start";
                this.currentSelection = selection;
                this.selectionOptions = this.calculateEndOptions(selection)
                this.setSelectionTypeForOptions("end", this.selectionOptions)
            } else {
                // SET THE END - where a card is going to
                let card = this.getCardFromSelection(previousSelection)
                // remove the card from current location
                if (previousSelection.location == "freeCell") {
                    this.state.freeCells[previousSelection.column] = { selectionType: "none", value: 0, suit: 0 }
                } else if (previousSelection.location == "column") {
                    this.state.columns[previousSelection.column].pop()
                } else {
                    throw new Error("Unsupported selection location: " + selection.location)
                }
                // Add the card to it's new location
                if (selection.location == "freeCell") {
                    this.state.freeCells[selection.column] = card
                } else if (selection.location == "column") {
                    this.state.columns[selection.column].push(card)
                } else if (selection.location == "foundation") {
                    this.state.foundations[selection.column].push(card)
                } else {
                    throw new Error("Unsupported selection location" + selection.location)
                }
                // Save the result into movedCards
                movedCards.push(card)
                //Save results of selection to the local storage
                this.localStorageSaveState()
                // Start the next selection
                movedCards.push(...this.calculateStartOptions())
            }
        } else {
            // Clear selection and do a new start selection
            movedCards.push(...this.calculateStartOptions())
        }
        return movedCards
    }

    setSelectionTypeForOptions(selectionType: SelectionType, options: Array<SelectionOption>) {
        //Update the selection type for each card in the current state
        for (let option of options) {
            if (option.location === "freeCell") {
                this.state.freeCells[option.column].selectionType = selectionType
            } else if (option.location === "foundation") {
                this.state.foundations[option.column][option.row].selectionType = selectionType
            } else if (option.location === "column") {
                this.state.columns[option.column][option.row].selectionType = selectionType;
            }
        }
    }

    calculateStartOptions(): Array<Card> {
        // Iterate through possible start options and see what can be selected
        let movedCards: Array<Card> = []
        //Setup a return for cards that were moved as part of the autofoundations flag
        // Setup autoFoundationOption
        let autoFoundationStart: SelectionOption | undefined = undefined
        let autoFoundationEnd: SelectionOption | undefined = undefined
        //freeCell
        let options: Array<SelectionOption> = []
        for (let i = 0; i < this.numFreeCells; i++) {
            let card = this.state.freeCells[i]
            if (card.value !== 0) {
                let selection: SelectionOption = { location: "freeCell", column: i, row: 0 }
                let endOptions = this.calculateEndOptions(selection, true)
                if (endOptions.length > 0) {
                    options.push(selection)
                    card.selectionType = "end"
                    // Auto move cards to the foundation if appropriate, and autoFoundations is true
                    if (this.autoFoundations === true) {
                        for (let option of endOptions) {
                            if (option.location === "foundation") {
                                autoFoundationStart = selection
                                autoFoundationEnd = option
                            }
                        }
                    }
                }
            }
        }
        //columns
        for (let i = 0; i < this.numColumns; i++) {
            let lastIndex = this.state.columns[i].length - 1
            let card = this.state.columns[i][lastIndex]
            if (card.value !== 0) {
                let endOptions = this.calculateEndOptions({ location: "column", column: i, row: lastIndex }, true)
                if (endOptions.length > 0) {
                    let selection: SelectionOption = { location: "column", column: i, row: lastIndex }
                    options.push(selection)
                    card.selectionType = "end"
                    // Auto move cards to the foundation if appropriate
                    if (this.autoFoundations === true) {
                        for (let option of endOptions) {
                            if (option.location === "foundation") {
                                autoFoundationStart = selection
                                autoFoundationEnd = option
                            }
                        }
                    }
                }
            }
        }
        // set the current options
        this.selectionOptions = options
        // Perform autoFoundationOption - automatically moves cards to the foundation
        if (this.autoFoundations === true && autoFoundationStart !== undefined && autoFoundationEnd !== undefined) {
            movedCards.push(...this.select(autoFoundationStart)) //select start -- should not return a card
            movedCards.push(...this.select(autoFoundationEnd)) //select end -- should return a card
        }
        //Return the moved cards in the correct order, first to last as moved
        return movedCards
    }

    calculateEndOptions(selection: SelectionOption, truncateSearch: boolean = false): Array<SelectionOption> {
        // Calculate where the selected start card can end
        let card = this.getCardFromSelection(selection);
        // If trucateSearch is true; will return as soon as a single option found (saves time)
        let options: Array<SelectionOption> = []
        // Iterate through foundations
        for (let i = 0; i < 4; i++) {
            let lastIndex = this.state.foundations[i].length - 1
            let foundationCard = this.state.foundations[i][lastIndex]
            if (isLower(card, foundationCard)) {
                options.push({ location: "foundation", column: i, row: lastIndex })
                if (truncateSearch) {
                    return options
                }
            }
        }
        // Iterate through freeCells
        if (selection.location != "freeCell") {
            for (let i = 0; i < this.numFreeCells; i++) {
                let freeCell = this.state.freeCells[i]
                if (freeCell.value === 0) {
                    options.push({ location: "freeCell", column: i, row: 0 })
                    if (truncateSearch) {
                        return options
                    }
                }
            }
        }
        // Iterate through columns
        for (let i = 0; i < this.numColumns; i++) {
            let lastIndex = this.state.columns[i].length - 1
            let columnCard = this.state.columns[i][lastIndex]
            if (isHigher(card, columnCard) || columnCard.value === 0) {
                options.push({ location: "column", column: i, row: lastIndex })
                if (truncateSearch) {
                    return options
                }
            }
        }
        // Return the options
        return options
    }

    stringifyGameState(): string {
        let stringGameState: string =

            [...this.state.freeCells].sort(
                (a: Card, b: Card): number => {
                    //-1 left item should be before right, 0 sort equally, 1 sorted after
                    // Sort by value then suit 
                    let aNumber = a.value * 1000 + a.suit
                    let bNumber = b.value * 1000 + b.suit
                    return bNumber - aNumber //high to low sort
                }
            ).map(
                (card: Card) => stringifyCard(card)
            ).join("") +
            " | " +
            [...this.state.foundations].map(
                (column) => column.map(
                    (card: Card) => stringifyCard(card)
                ).join("")
            ).join(",") +
            " | " +
            [...this.state.columns].sort(
                // Sort by the top card in the stack   
                (a: Array<Card>, b: Array<Card>): number => {
                    let aNumber = a[a.length - 1].value * 1000 + a[a.length - 1].suit
                    let bNumber = b[b.length - 1].value * 1000 + b[b.length - 1].suit
                    return bNumber - aNumber //high to low sort
                }
            ).map(
                (column) => column.map(
                    (card: Card) => stringifyCard(card)
                ).join("")
            ).join(",")
        return stringGameState
    }

    copy(): Game {
        return new GameFromGame(this)
    }

    checkForWin(): boolean {
        //Check if the current position of the game is winning, by checking if no cards remain to be placed in the foundation
        for (let freeCell of this.state.freeCells) {
            if (freeCell.value == 0) {
                return false
            }
        }
        for (let column of this.state.columns) {
            if (column.length > 1) {
                return false
            }
        }
        return true
    }

    checkForLoss(): boolean {
        // Check if the game is a loss by checking if there are any selection options
        return this.selectionOptions.length == 0
    }
}

class GameFromGame extends Game {
    constructor(parentGame: Game) {
        super(
            { //options
                numColumns: parentGame.numColumns,
                numFreeCells: parentGame.numFreeCells,
                hardColumns: parentGame.hardColumns,
                autoFoundations: parentGame.autoFoundations
            },
            JSON.parse(JSON.stringify(parentGame.state)), //state
            JSON.parse(JSON.stringify(parentGame.selectionOptions)), //selectionOptions
            parentGame.currentSelection === undefined ?
                undefined : JSON.parse(JSON.stringify(parentGame.currentSelection)) //currentSelection
        )
    }
}

class GameFromState extends Game {
    constructor(state: GameState) {
        //Create a game from the state, use defualt options
        //MUST CALL calculateStartOptions if inital display of autofoundation is desired
        super(
            { //options
                numColumns: state.columns.length,
                numFreeCells: state.freeCells.length,
                hardColumns: defaultGameOptions.hardColumns,
                autoFoundations: defaultGameOptions.autoFoundations
            },
            JSON.parse(JSON.stringify(state)), //state
            [], //selectionOptions
            undefined //currentSelection
        )
    }
}

class RandomGame extends GameFromState {
    constructor() {
        //Randomize the game
        //Setup state
        let state: GameState = {
            freeCells: [],
            foundations: [],
            columns: [],
        };
        //Add empty cards and empty cells; Freecells, foundations, columns
        for (let i = 0; i < defaultGameOptions.numFreeCells; i++) {
            state.freeCells.push({ value: 0, suit: 0, selectionType: "none" });
        }
        for (let i = 0; i < 4; i++) {
            state.foundations.push([{ value: 0, suit: i + 1, selectionType: "none" }])
        }
        for (let i = 0; i < defaultGameOptions.numColumns; i++) {
            state.columns.push([{ value: 0, suit: 0, selectionType: "none" }]);
        }
        //Create a deck and shuffle it
        let deck: Array<Card> = [];
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
        super(state)
    }
}


class VisualManager {
    main: HTMLDivElement;
    drawChain: Array<() => void>
    drawingInProgressFlag: boolean //true if activly drawing (discard call), if false initiate draw

    constructor(main: HTMLDivElement) {
        this.main = main;
        this.drawChain = []
        this.drawingInProgressFlag = false
    }

    drawGame(game: Game, showMoveCards: Array<Card>) {
        //Add to the chain & process a sync if appropriate 
        // A sync processing handled by processDrawingChain and processDrawGame
        // this.drawChain.push(() => this.processDrawGame(game.copy(), [])) //[...showMoveCards]
        // //Try to process the drawing chain
        // this.processDrawingChain()
        this.processDrawGame(game, showMoveCards)
    }

    // processDrawingChain() {
    //     //Check if this function already running, if not, process the next item in the drawing chain
    //     if (false && this.drawingInProgressFlag) {
    //         //If drawing in progress, let that event completion trigger the next step in drawing
    //         console.log("aborted, in progress")
    //         return
    //     }
    //     //Take control of the drawing process
    //     this.drawingInProgressFlag = true
    //     //Pop first item from chain & run, if no item return control
    //     let process = this.drawChain.shift()
    //     if (process === undefined) {
    //         this.drawingInProgressFlag = false
    //         return
    //     } else {
    //         process() //Execute the process, assumes that processDrawGame calls this function at the end
    //     }
    // }

    processDrawGame(game: Game, showMoveCards: Array<Card>) {
        //Draw the game presented, if showMove is defined, will animate the movement of
        // the array of cards from the previous position to the new positions
        //Get previous positions of the cards
        let fromCardPositionRects = showMoveCards.map(card => getCardClientRect(card, this.main))
        //Create and draw the top area
        let topArea = getElementByClass(this.main, 'top-area');
        removeNodeChildren(topArea)
        // Find and bind refresh button
        let refreshButton = document.getElementById('refresh') as HTMLDivElement
        refreshButton.onclick = () => {
            let game = new RandomGame()
            let movedCards = game.calculateStartOptions()
            this.drawGame(game, movedCards);
        }
        // Free Cells
        for (let i = 0; i < game.numFreeCells; i++) {
            let freeCell = document.createElement("div");
            topArea.appendChild(freeCell);
            freeCell.classList.add("free-cell");
            let card = game.state.freeCells[i]
            let f = () => {
                // onclick function for the card
                let movedCards = game.select({ location: "freeCell", column: i, row: 0 });
                this.drawGame(game, movedCards);
            }
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
                    let movedCards = game.select({ location: "foundation", column: i, row: j });
                    this.drawGame(game, movedCards);
                }
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
                let fullCard: CardDisplayStyle = (j == game.state.columns[i].length - 1) ? "full" : "partial";
                let f = () => {
                    // onclick function for the card
                    let movedCards = game.select({ location: "column", column: i, row: j });
                    this.drawGame(game, movedCards);
                }
                this.createCard(column, card, fullCard, f);
            }
        }
        // Calculate new positions of the cards & deltas between old and new positions
        //Iterate through each card that we would like to move,
        // assign to the animation class, define its offset in the x & y - position compute
        let finalAnimatedNode: HTMLDivElement | undefined = undefined //Tracks final animated element, so that chain can be called
        console.log("deep showMoveCard", showMoveCards)
        for (let i = 0; i < showMoveCards.length; i++) {
            let card = showMoveCards[i] //Final card position Node
            let cardNode = getCardDivNode(card, this.main)
            let toRect = getCardClientRect(card, this.main)
            let fromCard = fromCardPositionRects[i]
            if (fromCard !== undefined && toRect !== undefined && cardNode) {
                //If either is undefined, do not animate this card
                //Calcuate the translate values
                let deltaX = fromCard.x - toRect.x
                let deltaY = fromCard.y - toRect.y
                if (deltaX !== 0 || deltaY !== 0) {
                    cardNode.classList.add("animated-card")
                    cardNode.style.animation = "none"
                    cardNode.offsetHeight
                    cardNode.style.animation = ""
                    cardNode.style.setProperty("--translateFromX", deltaX.toString() + "px")
                    cardNode.style.setProperty("--translateFromY", deltaY.toString() + "px")
                    //Set listener for when event starts and ends
                    finalAnimatedNode = cardNode
                }
            }
        }
        //Add event listener to the final animated node so that call back to the listener chain can be made when appropriate
        if (finalAnimatedNode === undefined) {
            //Immediatly call on the chain to run the next value, do not need to wait for anything
            this.drawingInProgressFlag = false
            // this.processDrawingChain()
        } else {
            //Call the drawing chain for the next step
            finalAnimatedNode.addEventListener("animationend", () => {
                if (finalAnimatedNode !== null && finalAnimatedNode !== undefined) {
                    // finalAnimatedNode.classList.remove("animated-card")
                }
                this.drawingInProgressFlag = false
                // this.processDrawingChain()
            })
        }
    }


    createCard(area: HTMLDivElement, cardObject: Card, cardDisplayStyle: CardDisplayStyle, onclick: Function = function () { }) { // eslint-disable-line
        // Unpack card information
        let value = cardObject.value;
        let suit = cardObject.suit;
        // Gather template
        let templateArea = document.getElementById('template-area') as HTMLDivElement;
        let cardTemplate = templateArea.getElementsByClassName("playing-card-layout-box")[0] as HTMLDivElement;
        let card = cardTemplate.cloneNode(true) as HTMLDivElement;
        if (cardDisplayStyle == "partial") {
            card.classList.add("playing-card-layout-box-partial");
        } else if (cardDisplayStyle == "covered") {
            card.classList.add("playing-card-layout-box-fully-covered");
        }
        card.style.display = "block"; //Unhide template
        // Do highlight
        if (cardObject.selectionType == "start") {
            card.classList.add("card-start-highlight")
        } else if (cardObject.selectionType == "end") {
            card.classList.add("card-end-highlight")
        }
        // Update the value and the suit
        let valueString: string
        if (value == 1) {
            valueString = "A";
        } else if (value <= 10) {
            valueString = value.toString();
        } else if (value == 11) {
            valueString = "J";
        } else if (value == 12) {
            valueString = "Q";
        } else if (value == 13) {
            valueString = "K";
        } else {
            throw new Error("Unexpected card value")
        }
        for (let textArea of card.getElementsByClassName("playing-card-value")) {
            textArea.textContent = valueString;
        }
        //Update the suit & color
        let suitString: string;
        let suitColor: string;
        if (suit == 0) {
            suitString = "■";
            suitColor = "green";
        } else if (suit == 1) {
            suitString = "♠";
            suitColor = "black";
        } else if (suit == 2) {
            suitString = "♦";
            suitColor = "red";
        } else if (suit == 3) {
            suitString = "♣";
            suitColor = "black";
        } else if (suit == 4) {
            suitString = "♥";
            suitColor = "red";
        } else {
            throw new Error("Unexpected card suit")
        }
        for (let suitArea of card.getElementsByClassName("playing-card-suit")) {
            suitArea.textContent = suitString;
        }
        //Color the card
        card.style.color = suitColor;
        // Name the card
        card.setAttribute("name", stringifyCard(cardObject))
        // Add the onclick event
        card.onclick = function () { onclick() };
        area.appendChild(card);
        // Return the card for adding an onclick event
        return card
    }
}

let VM = new VisualManager(document.getElementById('main') as HTMLDivElement);
let loadState = localStorage.getItem("state")
let game: Game
let movedCards: Array<Card>
if (true && loadState !== null) {
    game = new GameFromState(JSON.parse(loadState));
    movedCards = game.calculateStartOptions()
} else {
    game = new RandomGame();
    movedCards = game.calculateStartOptions()
}

VM.drawGame(game, movedCards);

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

function bruteSolver(game: Game, scorecard: Scorecard,
    lookup: Record<string, Scorecard>, winningScorecard: Scorecard): Scorecard {
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
        let minRemainingSteps = game.state.columns.reduce(
            (partialSum, column) => partialSum + column.length - 1, 0)
        if (scorecard.steps + minRemainingSteps >= winningScorecard.steps) {
            //impossible to complete in fewer steps than the found winning state, break
            console.log("Perfect play from this scorecard requires too many steps")
            return winningScorecard
        }
    }
    //Check if the game is won
    if (game.checkForWin()) {
        // Add to the lookup as a win condition
        console.log("Found winning scorecard", scorecard)
        if (scorecard.steps < winningScorecard.steps) {
            // Replace the winning scorecard
            winningScorecard = scorecard
        }
        return winningScorecard
    }
    //Check if the game is lost
    if (game.checkForLoss()) {
        //console.log("Found losing scorecard", scorecard)
        return winningScorecard
    }
    //Check if self is in the bruteSolver
    let gameString = game.stringifyGameState()
    if (gameString in lookup) {
        // Test if this is a more efficient solution
        if (scorecard.steps < lookup[gameString].steps) {
            lookup[gameString] = scorecard
            //More efficiant, continue looking
        } else {
            // Less efficient, stop looking
            return winningScorecard
        }
    } else {
        //Gamestring not encountered before
        console.log(scorecard.steps, "gameString", gameString)
        lookup[gameString] = scorecard
        // vm.drawGame(game)
    }
    //Iterate through the next scorecard options
    for (let intermediarySelectionOption of game.selectionOptions) {
        //Select from location
        let intermediaryGame = game.copy()
        intermediaryGame.select(intermediarySelectionOption)
        for (let selectionOption of intermediaryGame.selectionOptions) {
            //Select too location
            let newGame = intermediaryGame.copy()
            newGame.select(selectionOption)
            let newActionList = [...scorecard.actionList]
            newActionList.push(selectionOption)
            let newScorecard: Scorecard = {
                state: game.state,
                steps: scorecard.steps + 1,
                actionList: newActionList
            }
            let returnScorecard = bruteSolver(newGame, newScorecard, lookup, winningScorecard)
            // set winning scorecard
            if (returnScorecard.steps < winningScorecard.steps) {
                winningScorecard = returnScorecard
            }
        }
    }
    // Return overall winning or losing scorecard
    return winningScorecard
}

// RUN SOLUTION SEARCH
if (false) { // eslint-disable-line
    let startingScorecard: Scorecard = { state: game.state, steps: 0, actionList: [] }
    let winningScorecard: Scorecard = { state: game.state, steps: infiniteSteps, actionList: [] }
    let lookup: Record<string, Scorecard> = {}
    let resultScorecard = bruteSolver(game, startingScorecard, lookup, winningScorecard)
    console.log("RESULT")
    console.log(resultScorecard)
}