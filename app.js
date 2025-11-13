let memory = [];
let memorySize = 20;
let policy = "FIFO";
let queue = [];
let lastUsed = {};
let currentTime = 0;

function updateStatus(msg) {
  document.getElementById("statusText").textContent = msg;
}

function initMemory(size) {
  memorySize = size;
  memory = new Array(size).fill(null);
  queue = [];
  lastUsed = {};
  renderMemory();
  document.getElementById("policyDisplay").textContent = policy;
  updateStatus(`Memory initialized (${size} blocks)`);
}

function allocate(pid, size) {
  let start = findFreeBlock(size);
  if (start === -1) {
    if (!evictProcess(size)) {
      updateStatus("Allocation failed — even after eviction");
      return;
    }
    start = findFreeBlock(size);
    if (start === -1) {
      updateStatus("Still not enough space!");
      return;
    }
  }
  for (let i = start; i < start + size; i++) memory[i] = pid;
  queue.push(pid);
  lastUsed[pid] = currentTime++;
  renderMemory();
  updateStatus(`Allocated P${pid} (${size} cells)`);
}

function deallocate(pid) {
  let freed = 0;
  for (let i = 0; i < memory.length; i++) {
    if (memory[i] === pid) {
      memory[i] = null;
      freed++;
    }
  }
  queue = queue.filter(p => p !== pid);
  delete lastUsed[pid];
  renderMemory();
  updateStatus(freed ? `Deallocated P${pid}` : `Process not found`);
}

function findFreeBlock(size) {
  let count = 0;
  for (let i = 0; i < memory.length; i++) {
    if (memory[i] === null) count++;
    else count = 0;
    if (count === size) return i - size + 1;
  }
  return -1;
}

function evictProcess(size) {
  while (findFreeBlock(size) === -1 && queue.length > 0) {
    const pid = policy === "FIFO" ? queue.shift() : findLRUProcess();
    deallocate(pid);
    updateStatus(`Evicted P${pid}`);
  }
  return findFreeBlock(size) !== -1;
}

function findLRUProcess() {
  let minPid = queue[0];
  let minTime = lastUsed[minPid];
  for (let pid of queue) {
    if (lastUsed[pid] < minTime) {
      minTime = lastUsed[pid];
      minPid = pid;
    }
  }
  queue = queue.filter(p => p !== minPid);
  return minPid;
}

function useProcess(pid) {
  if (lastUsed[pid] !== undefined) {
    lastUsed[pid] = currentTime++;
    updateStatus(`Used process P${pid}`);
  } else {
    updateStatus(`Process P${pid} not found`);
  }
}

function switchPolicy() {
  policy = policy === "FIFO" ? "LRU" : "FIFO";
  document.getElementById("policyDisplay").textContent = policy;
  updateStatus(`Switched to ${policy}`);
}

function renderMemory() {
  const map = document.getElementById("memoryMap");
  map.innerHTML = "";
  memory.forEach(cell => {
    const div = document.createElement("div");
    div.className = "cell";
    if (cell !== null) {
      div.textContent = cell;
      const hue = ((cell * 70) % 360 + 360) % 360;
      div.style.background = `hsl(${hue},70%,50%)`;
    } else {
      div.textContent = "";
      div.style.background = "#334155";
    }
    map.appendChild(div);
  });
}

function defragmentationStepAnimation() {
  let targetIndex = 0;
  let steps = [];

  for (let i = 0; i < memory.length; i++) {
    if (memory[i] !== null) {
      if (i !== targetIndex) steps.push({ from: i, to: targetIndex, pid: memory[i] });
      targetIndex++;
    }
  }

  function executeStep(index) {
    if (index >= steps.length) {
      renderMemory();
      updateStatus("Defragmentation complete");
      return;
    }
    const step = steps[index];
    memory[step.to] = step.pid;
    memory[step.from] = null;
    renderMemory();

    const divs = document.querySelectorAll(".cell");
    divs[step.to].classList.add("moved");

    setTimeout(() => {
      divs[step.to].classList.remove("moved");
      executeStep(index + 1);
    }, 400);
  }

  executeStep(0);
}

// Event Listeners
document.getElementById("initBtn").onclick = () => {
  const size = parseInt(document.getElementById("memSize").value);
  if (size > 0) initMemory(size);
  else updateStatus("Enter a valid memory size");
};

document.getElementById("allocBtn").onclick = () => {
  const pid = parseInt(document.getElementById("pid").value);
  const size = parseInt(document.getElementById("psize").value);
  if (managerExists()) allocate(pid, size);
};

document.getElementById("deallocBtn").onclick = () => {
  const pid = parseInt(document.getElementById("pid").value);
  if (managerExists()) deallocate(pid);
};

document.getElementById("useBtn").onclick = () => {
  const pid = parseInt(document.getElementById("pid").value);
  if (managerExists()) useProcess(pid);
};

document.getElementById("policyBtn").onclick = switchPolicy;
document.getElementById("defragBtn").onclick = defragmentationStepAnimation;

function managerExists() {
  if (!memory.length) {
    updateStatus("Initialize memory first!");
    return false;
  }
  return true;
}
