let memory = [];
let memorySize = 0;
let policy = "FIFO";
let queue = [];
let lastUsed = {};
let currentTime = 0;
let futureTrace = [];
let futureTracePos = 0;

function updateStatus(msg) {
  document.getElementById("statusText").textContent = msg;
}

function managerExists() {
  return memory.length > 0;
}

function getProcessPages(pid) {
  const arr = [];
  for (let i = 0; i < memory.length; i++) if (memory[i] === pid) arr.push(i);
  return arr;
}

function computePageNumbers() {
  const count = {},
    res = {};
  for (let i = 0; i < memory.length; i++) {
    const pid = memory[i];
    if (pid !== null) {
      if (!count[pid]) count[pid] = 0;
      res[i] = count[pid]++;
    }
  }
  return res;
}

function defragmentationStepInstant() {
  const arr = [];
  for (let i = 0; i < memory.length; i++)
    if (memory[i] !== null) arr.push(memory[i]);
  while (arr.length < memory.length) arr.push(null);
  memory = arr;
}

function pickLRUProcess() {
  let best = null,
    bestTime = Infinity;
  for (let pid of queue) {
    const t = lastUsed[pid] ?? Infinity;
    if (t < bestTime) {
      best = pid;
      bestTime = t;
    }
  }
  return best;
}

function pickOptimalProcess() {
  const nextUseMap = {};
  for (const pid of queue) nextUseMap[pid] = Infinity;
  for (let i = futureTracePos; i < futureTrace.length; i++) {
    const p = futureTrace[i];
    if (nextUseMap[p] === Infinity) nextUseMap[p] = i - futureTracePos;
    let allFound = true;
    for (const pid of queue)
      if (nextUseMap[pid] === Infinity) {
        allFound = false;
        break;
      }
    if (allFound) break;
  }
  let bestPid = null,
    bestDist = -1;
  for (const pid of queue) {
    const d = nextUseMap[pid];
    if (d === Infinity && bestDist !== Infinity) {
      bestPid = pid;
      bestDist = Infinity;
    } else if (d !== Infinity && bestDist !== Infinity && d > bestDist) {
      bestPid = pid;
      bestDist = d;
    } else if (bestPid === null) {
      bestPid = pid;
      bestDist = d;
    }
  }
  return bestPid;
}

function initMemory(size) {
  memorySize = size;
  memory = new Array(size).fill(null);
  queue = [];
  lastUsed = {};
  currentTime = 0;
  futureTrace = [];
  futureTracePos = 0;
  renderMemory();
  updateStatus(`Memory initialized (${size} blocks)`);
  document.getElementById("traceStatus").textContent = "No trace loaded";
  document.getElementById("policyDisplay").textContent = policy;
  const sel = document.getElementById("policySelect");
  sel.value = policy;
}

function findFreeBlock(size) {
  let count = 0;
  for (let i = 0; i < memory.length; i++) {
    if (memory[i] === null) count++;
    else count = 0;
    if (count >= size) return i - size + 1;
  }
  return -1;
}

function evictProcess(sizeNeeded) {
  function hasContiguous(size) {
    let cnt = 0;
    for (let i = 0; i < memory.length; i++) {
      if (memory[i] === null) cnt++;
      else cnt = 0;
      if (cnt >= size) return true;
    }
    return false;
  }
  if (hasContiguous(sizeNeeded)) return true;
  while (!hasContiguous(sizeNeeded) && queue.length > 0) {
    const pidToEvict =
      policy === "FIFO"
        ? queue[0]
        : policy === "LRU"
        ? pickLRUProcess()
        : policy === "OPTIMAL"
        ? pickOptimalProcess()
        : queue[0];
    if (!pidToEvict) break;
    const pages = getProcessPages(pidToEvict);
    if (pages.length === 0) {
      queue = queue.filter((p) => p !== pidToEvict);
      delete lastUsed[pidToEvict];
      continue;
    }
    const freeNow = memory.filter((x) => x === null).length;
    let stillNeeded = sizeNeeded - freeNow;
    if (stillNeeded <= 0 && hasContiguous(sizeNeeded)) break;
    const removeCount = Math.min(stillNeeded, pages.length);
    for (let i = 0; i < removeCount; i++) {
      const idx = pages[pages.length - 1 - i];
      memory[idx] = null;
    }
    if (removeCount === pages.length) {
      queue = queue.filter((p) => p !== pidToEvict);
      delete lastUsed[pidToEvict];
      updateStatus(`Evicted P${pidToEvict}`);
    } else {
      updateStatus(`Evicted ${removeCount} pages from P${pidToEvict}`);
    }
    defragmentationStepInstant();
  }
  return hasContiguous(sizeNeeded);
}

function allocate(pid, size) {
  if (!pid || !size || pid <= 0 || size <= 0) {
    updateStatus("Enter valid PID and Size");
    return;
  }
  if (size > memory.length) {
    updateStatus(
      `Error: Process requires ${size} pages but memory has only ${memory.length}`
    );
    return;
  }
  let start = findFreeBlock(size);
  if (start === -1) {
    const ok = evictProcess(size);
    if (!ok) {
      updateStatus("Not enough memory even after eviction");
      return;
    }
    start = findFreeBlock(size);
  }
  for (let i = start; i < start + size; i++) memory[i] = pid;
  if (!queue.includes(pid)) queue.push(pid);
  lastUsed[pid] = currentTime++;
  renderMemory();
  updateStatus(`Allocated P${pid} (${size} cells)`);
}

function deallocate(pid) {
  let removed = false;
  for (let i = 0; i < memory.length; i++) {
    if (memory[i] === pid) {
      memory[i] = null;
      removed = true;
    }
  }
  if (removed) {
    queue = queue.filter((p) => p !== pid);
    delete lastUsed[pid];
    renderMemory();
    updateStatus(`Deallocated P${pid}`);
  } else {
    updateStatus("Process not found");
  }
}

function useProcess(pid) {
  if (lastUsed[pid] !== undefined) {
    lastUsed[pid] = currentTime++;
    updateStatus(`Used P${pid}`);
    renderMemory();
  } else updateStatus("Process not found");
  if (futureTrace[futureTracePos] === pid) {
    futureTracePos++;
    document.getElementById(
      "traceStatus"
    ).textContent = `Trace pos ${futureTracePos}/${futureTrace.length}`;
  }
}

function switchPolicy() {
  policy = policy === "FIFO" ? "LRU" : policy === "LRU" ? "OPTIMAL" : "FIFO";
  document.getElementById("policyDisplay").textContent = policy;
  const sel = document.getElementById("policySelect");
  sel.value = policy;
  updateStatus(`Switched to ${policy}`);
}

function renderMemory() {
  const container = document.getElementById("memoryMap");
  container.innerHTML = "";
  const pageNums = computePageNumbers();
  memory.forEach((pid, i) => {
    const div = document.createElement("div");
    div.className = "cell";
    if (pid !== null) {
      div.innerText = `P${pid}\nPg ${pageNums[i]}`;
      div.style.background = `hsl(${(pid * 60) % 360}, 70%, 50%)`;
    }
    container.appendChild(div);
  });
}

function defragmentationStepAnimation() {
  let target = 0;
  const steps = [];
  for (let i = 0; i < memory.length; i++) {
    if (memory[i] !== null) {
      if (i !== target) steps.push({ from: i, to: target, pid: memory[i] });
      target++;
    }
  }
  function move(i) {
    if (i >= steps.length) {
      renderMemory();
      updateStatus("Defragmentation complete");
      return;
    }
    const s = steps[i];
    memory[s.to] = s.pid;
    memory[s.from] = null;
    renderMemory();
    const cells = document.querySelectorAll(".cell");
    cells[s.to].classList.add("moved");
    setTimeout(() => {
      cells[s.to].classList.remove("moved");
      move(i + 1);
    }, 300);
  }
  move(0);
}

function loadTraceFromTextarea() {
  const txt = document.getElementById("traceInput").value.trim();
  if (!txt) {
    futureTrace = [];
    futureTracePos = 0;
    document.getElementById("traceStatus").textContent = "No trace loaded";
    updateStatus("Cleared future trace");
    return;
  }
  const parts = txt
    .split(/[\s,]+/)
    .map((s) => parseInt(s))
    .filter((n) => !isNaN(n));
  futureTrace = parts;
  futureTracePos = 0;
  document.getElementById(
    "traceStatus"
  ).textContent = `Trace loaded (${futureTrace.length} events)`;
  updateStatus(`Loaded future trace (${futureTrace.length} events)`);
}

document.getElementById("initBtn").onclick = () => {
  const size = parseInt(document.getElementById("memSize").value);
  if (size > 0) initMemory(size);
};

document.getElementById("allocBtn").onclick = () => {
  allocate(
    parseInt(document.getElementById("pid").value),
    parseInt(document.getElementById("psize").value)
  );
};

document.getElementById("deallocBtn").onclick = () => {
  deallocate(parseInt(document.getElementById("pid").value));
};

document.getElementById("useBtn").onclick = () => {
  useProcess(parseInt(document.getElementById("pid").value));
};

document.getElementById("policyBtn").onclick = switchPolicy;
document.getElementById("defragBtn").onclick = defragmentationStepAnimation;
document.getElementById("loadTraceBtn").onclick = loadTraceFromTextarea;
document.getElementById("policySelect").onchange = (e) => {
  policy = e.target.value;
  document.getElementById("policyDisplay").textContent = policy;
  updateStatus(`Policy set to ${policy}`);
};

initMemory(memorySize);
