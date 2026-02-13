////////////////////////////////////////////////////////////////////////
//            JS-CODE FOR 2D ACTIVE FUNCTION LEARNING                 //
//        cordova version and refactoring: Federico Meini             //
//            original work: CHARLEY WU, ERIC SCHULZ                  //
//   edited by: ALISSA RIVERO, BEN PITT, MAXIME DEREX, DORSA AMIR     //
////////////////////////////////////////////////////////////////////////

// Touch events support
var clickEventType = "click";
window.addEventListener("touchstart", function () {
  clickEventType = "touchstart";
});

// ==============================
// VISUAL SETTINGS (NEW)
// ==============================
var DUKE_BLUE = "#012169";

// -----------------------------
// NEW: circle sizing + collected box animation helpers
// -----------------------------
function clamp(v, lo, hi) {
  return Math.max(lo, Math.min(hi, v));
}

// Map a point value to an SVG radius (0..45 within viewBox 0..100).
// Uses trial-specific max (scale + 5) so the sizing matches the current trial’s range.
function radiusForValue(value) {
  var maxV =
    typeof trialCounter !== "undefined" && trialCounter >= 0 && scale[trialCounter] != null
      ? scale[trialCounter] + 5
      : 50;

  var t = value / maxV;
  t = clamp(t, 0, 1);

  var rMin = 0;
  var rMax = 45;
  return rMin + t * (rMax - rMin);
}

// Ensure the collected box exists and has enough slots.
// NOTE: You must add <div id="collectedBox"></div> somewhere on the right side in index.html
// and CSS for #collectedBox/.collected-item/.fly-circle.
function ensureCollectedBoxSlots() {
  var box = document.getElementById("collectedBox");
  if (!box) return;

  // visual cap so the UI doesn't explode
  var desired = 60;

  if (box.children.length >= desired) return;

  for (var i = box.children.length; i < desired; i++) {
    var slot = document.createElement("div");
    slot.className = "collected-item";
    slot.setAttribute("data-slot", i);
    box.appendChild(slot);
  }
}

function nextEmptyCollectedSlot() {
  var box = document.getElementById("collectedBox");
  if (!box) return null;

  var slots = box.querySelectorAll(".collected-item");
  for (var i = 0; i < slots.length; i++) {
    if (!slots[i].dataset.filled) return slots[i];
  }
  return null;
}

// Create a "flying" circle overlay from the clicked cell to the next empty slot.
// Then stamp a static circle into the slot.
function animateCircleToCollectedBox(fromTd, value) {
  var box = document.getElementById("collectedBox");
  if (!box || !fromTd) return;

  ensureCollectedBoxSlots();
  var slot = nextEmptyCollectedSlot();
  if (!slot) return;

  var fromRect = fromTd.getBoundingClientRect();
  var startX = fromRect.left + fromRect.width / 2;
  var startY = fromRect.top + fromRect.height / 2;

  var toRect = slot.getBoundingClientRect();
  var endX = toRect.left + toRect.width / 2;
  var endY = toRect.top + toRect.height / 2;

  var fly = document.createElement("div");
  fly.className = "fly-circle";
  fly.innerHTML =
    '<svg viewBox="0 0 100 100" preserveAspectRatio="xMidYMid meet">' +
    '<circle cx="50" cy="50" r="45"></circle>' +
    "</svg>";

  var c = fly.querySelector("circle");
  if (c) {
    c.setAttribute("fill", DUKE_BLUE);
    c.setAttribute("stroke", "rgba(0,0,0,0.25)");
    c.setAttribute("stroke-width", "2");
  }

  document.body.appendChild(fly);

  // place at start (centered). fly-circle CSS default is 34x34, so offset by 17.
  fly.style.transform = "translate(" + (startX - 17) + "px," + (startY - 17) + "px)";

  requestAnimationFrame(function () {
    fly.style.transform = "translate(" + (endX - 17) + "px," + (endY - 17) + "px)";
  });

  var done = false;
  var finalize = function () {
    if (done) return;
    done = true;

    slot.innerHTML =
      '<svg viewBox="0 0 100 100" preserveAspectRatio="xMidYMid meet">' +
      '<circle cx="50" cy="50" r="' +
      radiusForValue(value) +
      '"></circle>' +
      "</svg>";

    var sc = slot.querySelector("circle");
    if (sc) {
      sc.setAttribute("fill", DUKE_BLUE);
      sc.setAttribute("stroke", "rgba(0,0,0,0.15)");
      sc.setAttribute("stroke-width", "2");
    }

    slot.dataset.filled = "1";

    if (fly && fly.parentNode) fly.parentNode.removeChild(fly);
  };

  fly.addEventListener("transitionend", finalize);
  setTimeout(finalize, 700);
}

//EXPERIMENT PARAMETERS
var fullurl = document.location.href, //url of incoming MTurk worker
  totalTrialsNumber = 10, // includes the instructions trial and the bonus trial
  trials = totalTrialsNumber, //number of REMAINING trials
  trialCounter = -1, //counter for current trial number
  horizon = 25,
  tracker = new Array(0), //tracker array
  investigationIndex = 0, //current click number
  scoretotal = [],
  scorecurrent = 0,
  reward = 0.0,
  starArray = [],
  gridMax = [],
  envOrder = getRandomSubarray(
    [
      0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20,
      21, 22, 23, 24, 25, 26, 27, 28, 29, 30, 31, 32, 33, 34, 35, 36, 37, 38, 39,
    ],
    totalTrialsNumber
  ),
  currentEnv = envOrder[0],
  environmentList = [],
  scale = [],
  //Color parameters for heatmap (kept for compatibility; no longer used for circle color)
  colors = ["#fff7ec", "#fee8c8", "#fdd49e", "#fdbb84", "#fc8d59", "#ef6548", "#d7301f", "#b30000", "#7f0000"],
  heatmapColor = d3.scale
    .linear()
    .domain(d3.range(0, 50, 50.0 / (colors.length - 1)))
    .range(colors),
  testerNotes = {};

//data collectors for search history
var tscollect = [],
  xcollect = [],
  ycollect = [],
  zcollect = [],
  zcollectScaled = [],
  initcollect = [],
  bonusCollect = { bonusCells: [], finalChosenCell: null };

/*
- x,y of the 5 randomly selected tiles
- mean judgements (slider value): 0 - 50
- confidence (radios) 1 - 7
- index of chosen tile among the five (and this last tile gets also played and added to xcollect, ycollect....)
 */

//Populate data collectors with empty arrays
for (var i = 0; i < totalTrialsNumber; i++) {
  scale[i] = randomNum(30, 40);
  scoretotal[i] = 0;
  starArray[i] = 0;
  gridMax[i] = 0;
  tscollect[i] = [];
  xcollect[i] = [];
  ycollect[i] = [];
  zcollect[i] = [];
  zcollectScaled[i] = [];
  initcollect[i] = [];
}

// Set initial counters
if (localStorage.getItem("gridsearch-counter-1") === null) localStorage.setItem("gridsearch-counter-1", 0);
if (localStorage.getItem("gridsearch-counter-2") === null) localStorage.setItem("gridsearch-counter-2", 0);
if (localStorage.getItem("gridsearch-counter-3") === null) localStorage.setItem("gridsearch-counter-3", 0);

//Declare variables not yet assigned
var condition,
  gender,
  age = 0,
  birthDate,
  grade,
  searchHistory,
  initialEnvs,
  changeEnvs,
  roundScore,
  xout,
  yout,
  zout,
  optimaGuess;

//Access the MySQL database and returns scenario id with a condition numnber, adding the now() date time to the start time field and marking the specific scenario as completed
function assignScenario() {
  //Extract gender and birthdate
  if (document.getElementById("Male").checked) gender = "Male";
  if (document.getElementById("Female").checked) gender = "Female";

  var dob = document.getElementById("birthDate").value;
  grade = parseInt(document.getElementById("gradeSelect").value);

  //Check if any data missing
  var checksum = typeof gender !== "undefined" && dob != null && dob != "";
  if (checksum) {
    age = getAge(dob);

    var counter = 0;
    if (age <= 9) {
      counter = getCounter("gridsearch-counter-1");
    } else if (age > 9 && age < 18) {
      counter = getCounter("gridsearch-counter-2");
    } else if (age > 18) {
      counter = getCounter("gridsearch-counter-3");
    }

    condition = counter % 2;
    clicks = horizon; //set initial number of clicks to horizon

    //Load initial environments
    var initialEnvsLocal = condition == 0 ? smoothKernel : roughKernel;

    //put environments from the randomized envOrder into environmentList
    for (i = 0; i <= trials; i++) {
      environmentList[envOrder[i]] = initialEnvsLocal[envOrder[i]];
    }

    //Advance the page
    nexttrial();
    clickStart("page1", "page5");
  } else {
    alert("Fehlende Daten."); // remind to fill out all the data
  }

  setButtonHandlers();
}

//Checkers:
var init = [];

function instructioncheck() {
  //check if correct answers are provided
  var ch1 = 0,
    ch2 = 0,
    ch3 = 0;
  if (document.getElementById("q1b").checked) ch1 = 1;
  if (document.getElementById("q2c").checked) ch2 = 1;
  if (document.getElementById("q3d").checked) ch3 = 1;

  var checksum = ch1 + ch2 + ch3;
  if (checksum === 3) {
    clicks = 0;
    gridDeactivated = false;
    nexttrial();
    clickStart("page3", "page5");
  } else {
    alert("Du hast einige Fragen falsch beantwortet. Bitte versuche es erneut");

    trials = totalTrialsNumber - 1;
    instructionsCounter = 0;
    document.getElementById("sidebarContent").style.display = "none";
    document.getElementById("sidebarInstructions").style.display = "block";
    clickStart("page3", "page5");
  }
}

/**
 * onDocumentReady
 */
document.addEventListener("DOMContentLoaded", function () {
  document.getElementById("buttonAssignScenario").addEventListener("click", function () {
    assignScenario();
  });

  // If you added the collected box in HTML, prep slots.
  ensureCollectedBoxSlots();
});

/**
 * Sets the button handlers
 */
function setButtonHandlers() {
  document.getElementById("goToPage7").addEventListener(clickEventType, function () {
    clickStart("page6", "page7");
  });
  document.getElementById("finishButton").addEventListener(clickEventType, function () {
    onButtonFinishPressed();
  });
  document.getElementById("nextTrialButton").addEventListener(clickEventType, function () {
    nexttrial();
  });
  document.getElementById("buttonGoToPageFive").addEventListener(clickEventType, function () {
    clickStart("page4", "page5");
  });
  document.getElementById("buttonInstructionsCheck").addEventListener(clickEventType, function () {
    instructioncheck();
  });
  document.getElementById("buttonGoToPageThree").addEventListener(clickEventType, function () {
    clickStart("page2", "page3");
  });
  document.getElementById("buttonGoToBonusLevel").addEventListener(clickEventType, function () {
    nextBonusLevelStep();
  });
  document.getElementById("buttonNextBonus").addEventListener(clickEventType, function () {
    saveBonusStep();
  });
  document.getElementById("buttonInstructions").addEventListener(clickEventType, function () {
    onButtonInstructionsPressed();
  });
}

// Instructions status
var instructionsCounter = 0;
var gridDeactivated = true;

/**
 *  button Instructions event handler
 */
function onButtonInstructionsPressed() {
  if (instructionsCounter == 0) {
    document.getElementById("sidebarInstructions-1").style.display = "none";
    document.getElementById("sidebarInstructions-2").style.display = "block";
    if (clicks > 0) gridDeactivated = false;
    instructionsCounter++;
  } else if (instructionsCounter == 1) {
    if (clicks > 0) {
      alert("Bitte benutze alle 25 Klicks um das Spielfeld zu erkunden.");
      return;
    }
    gridDeactivated = true;
    document.getElementById("sidebarInstructions-2").style.display = "none";
    document.getElementById("sidebarInstructions-3").style.display = "block";
    instructionsCounter++;
  } else if (instructionsCounter == 2) {
    clickStart("page5", "page3");
    document.getElementById("sidebarInstructions").style.display = "none";
    document.getElementById("sidebarInstructions-3").style.display = "none";
    document.getElementById("sidebarInstructions-1").style.display = "block";
    document.getElementById("sidebarContent").style.display = "block";
  }
}

function onButtonFinishPressed() {
  var optionA = document.querySelector('input[name="option-a"]:checked');
  if (optionA == null) {
    return alert("Fill option A!");
  }

  var notes = document.getElementById("tester-notes").value;

  testerNotes = {
    "option-a": parseInt(optionA.value),
    notes: notes,
  };

  senddata();
}

/**
 * Creates the grid in the DOM
 */
function createGrid() {
  var WIDTH = 8,
    HEIGHT = 8;

  var table = document.createElement("table");
  table.setAttribute("id", "grid");
  table.setAttribute("class", "grid");

  for (var y = 0; y < HEIGHT; y++) {
    var tr = document.createElement("tr");
    for (var x = 0; x < WIDTH; x++) {
      var td = document.createElement("td");
      td.setAttribute("data-x", x);
      td.setAttribute("data-y", y);
      td.addEventListener(clickEventType, onCellTappedHandler);

      // SVG circle + label.
      // IMPORTANT: do NOT overwrite td.innerHTML elsewhere; update circle/label instead.
      td.innerHTML =
          '<svg class="cell-svg" viewBox="0 0 100 100" preserveAspectRatio="xMidYMid meet">' +
          '<circle class="cell-circle" cx="50" cy="50" r="0" fill="' + DUKE_BLUE + '"></circle>' +
           "</svg>";

      tr.appendChild(td);
    }
    table.appendChild(tr);
  }

  var gridContainer = document.getElementById("gridDiv");
  gridContainer.innerHTML = "";
  gridContainer.appendChild(table);
}

/**
 *  onCellTappedHandler()
 */
function onCellTappedHandler(evt) {
  // If user taps SVG/circle, evt.target isn't the <td>.
  var td = evt.target && evt.target.closest ? evt.target.closest("td") : evt.target;
  if (!td || !td.getAttribute) return;

  var x = td.getAttribute("data-x");
  var y = td.getAttribute("data-y");
  var cell = Cell.getCell(x, y);

  if (playingBonusRound) return onBonusCellTapped(cell);
  return onCellTapped(cell);
}

/**
 *  onCellTapped()
 */
function onCellTapped(cell) {
  if (cell == null || gridDeactivated) return;

  // normal click -> animate to collected box
  cell.clicked(true);

  // update counters
  currentEnvNum = envOrder[trialCounter];
  investigationIndex = investigationIndex + 1;
  tracker[investigationIndex] = cell.x + "x" + cell.y;

  //update number of clicks left
  clicks = clicks - 1;
  change("remaining2", "Verbleibende Klicks: <b>" + clicks + "</b>");

  //Update maximum reward found
  if (cell.rescaledValue > gridMax[trialCounter]) {
    gridMax[trialCounter] = cell.rescaledValue;
  }

  //keep track of tapped cell
  var d = new Date();
  tscollect[trialCounter][investigationIndex] = d.getTime();
  xcollect[trialCounter][investigationIndex] = cell.x;
  ycollect[trialCounter][investigationIndex] = cell.y;
  zcollect[trialCounter][investigationIndex] = cell.noiseyValue;
  zcollectScaled[trialCounter][investigationIndex] = cell.rescaledValue;

  // update score
  scorecurrent = Math.round(cell.rescaledValue);
  scoretotal[trialCounter] = scoretotal[trialCounter] + scorecurrent;
  reward = rewardCum(scoretotal);
  roundScore = performanceScore(scoretotal[trialCounter], scale[trialCounter]);
  change("scoretotal", "Punktzahl: " + scoretotal[trialCounter]);

  // CASE: first (demo) trial
  if (trials == totalTrialsNumber - 1 && clicks > 0) {
    return;
  }

  // CASE: first (demo) trial ended
if (trials == totalTrialsNumber - 1 && clicks == 0) {
  gridDeactivated = true;

  // Ensure the instruction panel is visible and the "Continue" button works
  document.getElementById("sidebarInstructions").style.display = "block";
  document.getElementById("sidebarContent").style.display = "none";

  document.getElementById("sidebarInstructions-1").style.display = "none";
  document.getElementById("sidebarInstructions-2").style.display = "none";
  document.getElementById("sidebarInstructions-3").style.display = "block";

  // Put the instruction flow into the expected state for the final "Continue"
  instructionsCounter = 2;

  return;
}

  // CASE: out of investigations
  if (clicks == 0) {
    starRating = starsEarned(roundScore);
    starArray[trialCounter] = parseFloat(starRating);

    clickStart("page5", "page5finished");

    // last-1 trial (the one before bonus) just ended
    if (trials == 1) {
      document.getElementById("bonusIntroInstructions").style.display = "block";
      document.getElementById("bonusSidebarInstructions").style.display = "block";
      document.getElementById("sidebarContent").style.display = "none";
    }

    starDiv =
      '<div class="star-ratings-css"><div class="star-ratings-css-top" style="width: ' +
      roundScore +
      '%"></div><div class="star-ratings-css-bottom"></div><br><br>';
    addToDiv("stars", starDiv);

    var remainingMsg = trials - 1 == 1 ? "weiteres Feld." : "weitere Felder.";
    completionDiv =
      '<br><br><br><br><h1 class="text-xl">Du hast dieses Feld erkundet und hast <b>' +
      starRating +
      " Sterne gesammelt</b>. Du hast noch " +
      trials +
      " " +
      remainingMsg +
      "</h1><br><br><br>" +
      starDiv +
      "<br><br><br>";
    change("trials", completionDiv);
  }

  // CASE: last trial AND 10 investigations remaining
  if (trials == 0 && clicks == 10) {
    document.getElementById("gridDiv").style.display = "none";
    document.getElementById("alertGridDiv").style.display = "block";
    document.getElementById("progress").style.display = "none";
  }

  // CASE: last trial AND out of investigations
  if (trials == 0 && clicks == 0) {
    document.getElementById("nextTrialButton").onclick = clickStart("page5finished", "page6");
    GameOverScore = finalPerformance(scoretotal);
    finalStarCount = totalStarsEarned(starArray);

    finalStarDiv = document.getElementById("stars").innerHTML;
    completionDiv =
      '<h1 class="text-xl">Wow! Das hast du super gemacht! Und du hast insgesamt ganze <b>' +
      finalStarCount +
      " Sterne gesammelt</b>! Vielen Dank fürs Spielen!</b> </h1>" +
      finalStarDiv +
      "";
    change("thanksforcompleting", completionDiv);
  }
}

////////////////////////////////////////
// BONUS LEVEL
////////////////////////////////////////
var bonusLevelStep = 0;
var bonusCells = [];
var currentBonusCell = null;
var playingBonusRound = false;
var sliderMoved = false;
var confidenceSliderMoved = false;

function nextBonusLevelStep() {
  // bonus level init
  if (bonusLevelStep == 0) {
    playingBonusRound = true;
    bonusCells = Cell.getRandomCells(5);
    document.getElementById("gridDiv").style.display = "block";
    document.getElementById("alertGridDiv").style.display = "none";
    document.getElementById("bonusProgress").style.display = "block";
  }

  sliderMoved = false;
  confidenceSliderMoved = false;

  currentBonusCell = bonusCells[bonusLevelStep];
  currentBonusCell.getTd().classList.toggle("border-blink");
}

function saveBonusStep() {
  var confidenceSlider = document.getElementById("confidenceSlider");
  var sicherValue = confidenceSlider != null ? confidenceSlider.value : null;

  var range = document.getElementById("valueSlider");
  var rangeValue = range != null ? range.value : null;

  if (sicherValue == null || !sliderMoved || !confidenceSliderMoved) {
    alert("Bitte gib Werte für beide Regler an.");
    return;
  }

  // clear previous bonus cell
  if (currentBonusCell != null) {
    currentBonusCell.clearTempValue();
    currentBonusCell.getTd().classList.toggle("border-blink");
    currentBonusCell.getTd().classList.toggle("border-dashed");
  }

  bonusCollect.bonusCells[bonusLevelStep] = {
    x: currentBonusCell.x,
    y: currentBonusCell.y,
    givenValue: parseInt(rangeValue),
    howSecure: parseInt(sicherValue),
  };

  document.getElementById("bonusRemainingCounter").innerHTML = 5 - (bonusLevelStep + 1);

  confidenceSlider.value = 5;
  range.value = 25;

  bonusLevelStep++;

  if (bonusLevelStep == 5) return saveBonusLevel();
  nextBonusLevelStep();
}

function saveBonusLevel() {
  currentBonusCell = null;
  document.getElementById("bonusInstructions2").style.display = "block";
  document.getElementById("bonusInstructions").style.display = "none";
}

function chooseBonusCellToPlay() {
  for (var i = 0; i < bonusCells.length; i++) {
    bonusCells[i].getTd().classList.toggle("border-dashed");
  }
}

function onBonusCellTapped(cell) {
  if (bonusCells.indexOf(cell) == -1 || bonusLevelStep <= 4) return;

  var r = confirm("Bist du dir sicher?");
  if (!r) return;

  document.getElementById("bonusSidebarInstructions").style.display = "none";
  document.getElementById("bonusSidebarInstructions2").style.display = "block";

  playingBonusRound = false;
  for (var i = 0; i < bonusCells.length; i++) {
    bonusCells[i].getTd().classList.toggle("border-dashed");
  }

  bonusCollect.finalChosenCell = {
    x: cell.x,
    y: cell.y,
    scaledValue: cell.scaledValue,
  };

  onCellTapped(cell);

  document.getElementById("gridDiv").style.display = "block";
  document.getElementById("bonusProgress").style.display = "none";
  document.getElementById("progress").style.display = "block";
}

function onValueSliderChange(value) {
  if (currentBonusCell != null) currentBonusCell.setTempValue(value);
  sliderMoved = true;
}

function onConfidenceSliderChange() {
  confidenceSliderMoved = true;
}

////////////////////////////////////////
// Cell class
////////////////////////////////////////
function Cell(x, y, aValue, nValue, rValue) {
  this.x = x;
  this.y = y;
  this.absoluteValue = aValue;
  this.noiseyValue = nValue;
  this.rescaledValue = rValue;
  this.history = [];

  this.getTd = function () {
    var cells = document.querySelectorAll('td[data-x="' + this.x + '"][data-y="' + this.y + '"]');
    if (cells.length > 0) return cells[0];
    return null;
  };

  this.getCircle = function () {
    var td = this.getTd();
    return td ? td.querySelector(".cell-circle") : null;
  };

  this.addToHistory = function (value) {
    this.history.push(value);
    if (this.getTd()) this.getTd().setAttribute("title", this.history.toString());
  };

  this.hasHistory = function () {
    return this.history.length > 0;
  };

  // Update visual rendering: ONLY size changes with value; color stays Duke blue.
  this.renderValue = function (valueToRender, updateTitle) {
    var td = this.getTd();
    var circle = this.getCircle();

    if (circle) {
      circle.setAttribute("r", radiusForValue(valueToRender));
      circle.setAttribute("fill", DUKE_BLUE);
    }

    if (td && updateTitle) {
      td.setAttribute("title", valueToRender.toString());
    }
  };

  this.updateValue = function () {
    this.noiseyValue = Math.round(this.absoluteValue + myNorm());
    var newRescaledValue = Math.max(Math.round((this.noiseyValue / 50) * scale[trialCounter] + 5), 0);
    this.rescaledValue = newRescaledValue;

    // If re-clicked, display circle size based on average history (like the old heatmap logic),
    // but now encoded by radius only.
    var avg = Math.round(average(this.history));
    this.renderValue(avg, false);
  };

  // shouldCollect: if true, animate this circle into the collectedBox.
  this.clicked = function (shouldCollect) {
    if (typeof shouldCollect === "undefined") shouldCollect = true;

    var td = this.getTd();
    if (!td) return;

    if (this.hasHistory()) {
      this.updateValue();
    } else {
      this.renderValue(this.rescaledValue, true);
    }

    this.addToHistory(this.rescaledValue);

    // Animate into collected box only for actual user clicks (not auto-reveal)
    if (shouldCollect) {
      animateCircleToCollectedBox(td, this.rescaledValue);
    }

    td.classList.toggle("highlight");
    setTimeout(function () {
      td.classList.toggle("highlight");
    }, 300);
  };

  // Bonus UI: show guessed value as circle size (still Duke blue)
  this.setTempValue = function (value) {
    var v = parseInt(value);
    if (isNaN(v)) return;
    this.renderValue(v, false);
  };

  this.clearTempValue = function () {
    var circle = this.getCircle();
    if (circle) circle.setAttribute("r", 0);
  };

  /**
   * Static properties and methods
   */
  Cell.updateEnvironment = function () {
    Cell.cells = [];
    for (i = 0; i < 8; i++) {
      Cell.cells[i] = [];
    }
    console.log("trialCounter in updateEnvironment() is: " + trialCounter);
    var env = environmentList[envOrder[trialCounter]];
    for (var k = 0; k <= 63; k++) {
      var x = env[k].x1;
      var y = env[k].x2;
      var absoluteValue = env[k].y * 50;
      var noiseyValue = Math.round(absoluteValue + myNorm());
      var rescaledValue = Math.max(Math.round((noiseyValue / 50) * scale[trialCounter] + 5), 0);
      var cell = new Cell(x, y, absoluteValue, noiseyValue, rescaledValue);
      Cell.cells[x][y] = cell;
    }
  };

  Cell.getCell = function (x, y) {
    return Cell.cells[x][y];
  };

  Cell.getRandomCell = function () {
    var x = Math.floor(Math.random() * Cell.cells.length);
    var y = Math.floor(Math.random() * Cell.cells[x].length);
    return Cell.getCell(x, y);
  };

  Cell.getRandomCells = function (n) {
    var randomCells = [];
    for (var i = 0; i < n; i++) {
      var found = false;
      while (!found) {
        var cell = this.getRandomCell();
        if (!cell.hasHistory() && randomCells.indexOf(cell) == -1) {
          randomCells.push(cell);
          found = true;
        }
      }
    }
    return randomCells;
  };
}
new Cell();

function nexttrial() {
  console.log("nexttrial called");

  trials = trials - 1;
  console.log("[Debug] You have now " + trials + " reamaining trials");

  if (trials >= 0) {
    initcollect[trialCounter] = init;

    trialCounter = trialCounter + 1;

    createGrid();
    Cell.updateEnvironment();
    var firstCell = Cell.getRandomCell();

    // IMPORTANT: initial reveal should NOT animate into collected box
    firstCell.clicked(false);

    //store initial values
    var d = new Date();
    tscollect[trialCounter][0] = d.getTime();
    xcollect[trialCounter][0] = firstCell.x;
    ycollect[trialCounter][0] = firstCell.y;
    zcollect[trialCounter][0] = firstCell.noiseyValue;
    zcollectScaled[trialCounter][0] = firstCell.rescaledValue;

    gridMax[trialCounter] = firstCell.rescaledValue;
    scoretotal[trialCounter] = firstCell.rescaledValue;

    change("scoretotal", "Punktzahl: " + scoretotal[trialCounter]);
    clickStart("page5finished", "page5");

    clicks = horizon;
    investigationIndex = 0;

    change("remaining1", "Verbleibende Spielfelder: <b>" + (trials + 1) + "</b>");
    change("remaining2", "Verbleibende Klicks: <b>" + clicks + "</b>");
  }

  if (trials < 0) {
    clickStart("page5", "page6");
  }
}

function debugData() {
  console.log(tscollect);
  console.log(xcollect);
  console.log(ycollect);
  console.log(zcollect);
}

function senddata() {
  searchHistory = {
    tscollect: tscollect,
    xcollect: xcollect,
    ycollect: ycollect,
    zcollect: zcollect,
    zcollectScaled: zcollectScaled,
  };

  saveDataArray = {
    condition: condition,
    scale: scale,
    envOrder: envOrder,
    searchHistory: searchHistory,
    bonusLevel: bonusCollect,
    starArray: starArray,
    age: age,
    gender: gender,
    grade: grade,
    testerNotes: testerNotes,
  };

  incrementCounter();

  console.log("[DEBUG] SavaData Array:");
  console.log(saveDataArray);

  isrcUtils.SaveAndEnd(saveDataArray);
  clickStart("page7", "rt-end");
}

//*************UTILITIES***************************************

function clickStart(hide, show) {
  document.getElementById(hide).style.display = "none";
  document.getElementById(show).style.display = "block";
  window.scrollTo(0, 0);
}

function change(x, y) {
  document.getElementById(x).innerHTML = y;
}

function addToDiv(x, y) {
  document.getElementById(x).innerHTML += y;
}

function shuffle(o) {
  for (var j, x, i = o.length; i; j = Math.floor(Math.random() * i), x = o[--i], o[i] = o[j], o[j] = x);
  return o;
}

function getRandomSubarray(arr, size) {
  var shuffled = arr.slice(0),
    i = arr.length,
    temp,
    index;
  while (i--) {
    index = Math.floor((i + 1) * Math.random());
    temp = shuffled[index];
    shuffled[index] = shuffled[i];
    shuffled[i] = temp;
  }
  return shuffled.slice(0, size);
}

function loadJSON(file, callback) {
  var rawFile = new XMLHttpRequest();
  rawFile.overrideMimeType("application/json");
  rawFile.open("GET", file, true);
  rawFile.onreadystatechange = function () {
    if (rawFile.readyState === 4 && rawFile.status == "200") {
      callback(rawFile.responseText);
    }
  };
  rawFile.send(null);
}

function myNorm() {
  var x1, x2, rad, c;
  do {
    x1 = 2 * Math.random() - 1;
    x2 = 2 * Math.random() - 1;
    rad = x1 * x1 + x2 * x2;
  } while (rad >= 1 || rad == 0);
  c = Math.sqrt((-2 * Math.log(rad)) / rad);
  return x1 * c;
}

function average(inputArray) {
  var total = 0;
  for (var i = 0; i < inputArray.length; i++) {
    total += inputArray[i];
  }
  return total / inputArray.length;
}

function rewardCum(scoreTotal) {
  var r = 0,
    r_i;
  for (var i = 0; i < scoreTotal.length; i++) {
    r_i = scoreTotal[i] / (scale[i] + 5) / 300 * 1.5;
    r = r + r_i;
  }
  if (r > 1.5) r = 1.5;
  return toFixed(r, 2);
}

function performanceScore(points, scale) {
  var r = 0;
  r = points / ((scale + 5) * horizon);
  return toFixed(r * 100);
}

function finalPerformance(scoreArray) {
  var finalScore = 0;
  for (i = 0; i < scoreArray.length; i++) {
    finalScore += parseInt(performanceScore(parseInt(scoreArray[i]), parseInt(scale[i])));
  }
  return toFixed(finalScore / scoreArray.length);
}

function starsEarned(score) {
  percentageScore = score / 100;
  scoreOutOfFive = percentageScore * 5;
  fixedScoreOutOfFive = toFixed(scoreOutOfFive, 1);
  return parseInt(fixedScoreOutOfFive) >= 5 ? 5 : fixedScoreOutOfFive;
}

function totalStarsEarned(starArray) {
  var totalStars = 0;
  for (i = 0; i < starArray.length; i++) {
    totalStars += parseFloat(starArray[i]);
  }
  return toFixed(totalStars);
}

function randomNum(min, max) {
  return Math.floor(Math.random() * (max - min + 1) + min);
}

function toFixed(value, precision) {
  var precision = precision || 0,
    power = Math.pow(10, precision),
    absValue = Math.abs(Math.round(value * power)),
    result = (value < 0 ? "-" : "") + String(Math.floor(absValue / power));

  if (precision > 0) {
    var fraction = String(absValue % power),
      padding = new Array(Math.max(precision - fraction.length, 0) + 1).join("0");
    result += "." + padding + fraction;
  }
  return result;
}

function turkGetParam(name) {
  var regexS = "[\\?&]" + name + "=([^&#]*)";
  var regex = new RegExp(regexS);
  var tmpURL = fullurl;
  var results = regex.exec(tmpURL);
  if (results == null) return "";
  return results[1];
}

function getAge(birthDate) {
  var dob = new Date(birthDate);
  var today = new Date();
  var age2 = today.getFullYear() - dob.getFullYear();
  var m = today.getMonth() - dob.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < dob.getDate())) age2--;
  return age2;
}

function getCounter(counterName) {
  if (localStorage.getItem(counterName) === null) return 0;
  return parseInt(localStorage.getItem(counterName));
}

function incrementCounter() {
  var counter = 0;
  if (age <= 9) {
    counter = getCounter("gridsearch-counter-1");
    localStorage.setItem("gridsearch-counter-1", counter + 1);
  } else if (age > 9 && age < 18) {
    counter = getCounter("gridsearch-counter-2");
    localStorage.setItem("gridsearch-counter-2", counter + 1);
  } else if (age > 18) {
    counter = getCounter("gridsearch-counter-3");
    localStorage.setItem("gridsearch-counter-3", counter + 1);
  }
}

//END
