function uuidv4() {
  return ([1e7] + -1e3 + -4e3 + -8e3 + -1e11).replace(/[018]/g, c =>
    (c ^ crypto.getRandomValues(new Uint8Array(1))[0] & 15 >> c / 4).toString(16)
  );
}

function secondsToHms(d) {
  d = Number(d);
  var h = Math.floor(d / 3600);
  var m = Math.floor(d % 3600 / 60);
  var s = Math.floor(d % 3600 % 60);
  var hDisplay = h > 0 ? h + (h == 1 ? " hr, " : " hrs, ") : "";
  var mDisplay = m > 0 ? m + (m == 1 ? " min, " : " mins, ") : "";
  var sDisplay = s > 0 ? s + (s == 1 ? " s" : " s") : "";
  return hDisplay + mDisplay + sDisplay;
}

var uuid = uuidv4();
let socketid = undefined;
var fileTypes = ['mp4'];
var uploadArea = document.getElementById('upload-area');
var inputClick = document.getElementById('input-click-upload');
var inputSwipe = document.getElementById('input-swipe-upload');
var uploadRect = document.getElementById('upload-rect');
var inputFilesInfo = [];

uploadRect.addEventListener('click', () => {
  inputClick.click();
});

uploadArea.addEventListener('dragover', (event) => {
  event.preventDefault();
  uploadArea.classList.add('dragover');
});

uploadArea.addEventListener('dragleave', (event) => {
  event.preventDefault();
  uploadArea.classList.remove('dragover');
});

function formatBytes(bytes, decimals = 2) {
  if (!+bytes) return '0 Bytes'

  const k = 1024
  const dm = decimals < 0 ? 0 : decimals
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB', 'PB', 'EB', 'ZB', 'YB']

  const i = Math.floor(Math.log(bytes) / Math.log(k))

  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(dm))} ${sizes[i]}`
}

function getVideoDimensionsOf(f) {
  const url = URL.createObjectURL(f);
  return new Promise(resolve => {
    const video = document.createElement('video');
    video.addEventListener("loadedmetadata", function () {
      const height = this.videoHeight;
      const width = this.videoWidth;
      const duration = this.duration;
      resolve({
        height,
        width,
        duration
      });
    }, false);
    video.src = url;
  });
}

async function appendUploadTable(files) {
  for (const f of files) {
    d = await getVideoDimensionsOf(f);
    fIndex = String(inputFilesInfo.length)
    fName = f.name.replace(/\.[^/.]+$/, "")
    fSizeMB = formatBytes(f.size);
    duration = secondsToHms(d.duration);
    height = d.height + " px"
    width = d.width + " px"
    technicalQuality = "-";
    aestheticQuality = "-";
    var finfo = [fIndex, fName, fSizeMB, duration, height, width, technicalQuality, aestheticQuality];
    inputFilesInfo.push(finfo);
  }
  dTable = $('#upload-table').DataTable({
    dom: '<"html5buttons"B>lTfgitp',
    destroy: true,
    select: true,
    processing: true,
    pagingType: "full_numbers",
    columns: [
      { title: "Index" },
      { title: "Filename" },
      { title: "Size" },
      { title: "Duration" },
      { title: "Height" },
      { title: "Width" },
      { title: "Technical" },
      { title: "Aesthetic" },
    ],
    data: inputFilesInfo,
    bLengthChange: false,
  });
}

uploadArea.addEventListener('drop', (event) => {
  event.preventDefault();
  uploadArea.classList.remove('dragover');
  var files = event.dataTransfer.files;
  let list = new DataTransfer();
  for (const f of inputSwipe.files) {
    list.items.add(f);
  }
  for (const f of files) {
    list.items.add(f);
  }
  inputSwipe.files = list.files;
  appendUploadTable(files);
});

inputClick.addEventListener('change', (event) => {
  event.preventDefault();
  let list = new DataTransfer();
  for (const f of inputSwipe.files) {
    list.items.add(f);
  }
  for (const f of inputClick.files) {
    list.items.add(f);
  }
  inputSwipe.files = list.files;
  appendUploadTable(inputClick.files);
});

function getOpinion(value) {
  var value = parseFloat(value);
  if (value >= 1) {
    return "Good";
  } else if (0 < value && value < 1) {
    return "Fair";
  } else if (-1 < value && value < 0) {
    return "Bad";
  } else {
    return "Worst";
  }
}

function onLoad() {
  document.getElementById("uuidText").innerHTML = uuid;
  const socket = io();
  socket.connect("https://localhost:5000");
  socket.on("connect", function () {
    socketid = socket.id;
    console.log(socketid);
  });
  socket.on("update progress", function (perecent) {
    console.log("Got perecent: " + perecent);
  })
}

function exportReportToExcel() {
  let table = document.getElementsByTagName("table");
  TableToExcel.convert(table[0], {
    name: uuid + `.xlsx`,
    sheet: { name: 'Sheet 1' }
  });
}

function evalUploads() {
  if (inputSwipe.files.length > 0) {

    const formData = new FormData();
    const files = inputSwipe.files;

    for (const f of files) {
      formData.append('files', f, f.name);
    }

    var requestOptions = {
      headers: {
        "Content-Type": "video/mp4",
      },
      mode: "no-cors",
      method: "POST",
      body: formData,
      redirect: "follow"
    };

    var url = new URL("http://localhost:5000/assess/" + socketid);
    url.searchParams.append('fname', uuid);

    fetch(url, requestOptions)
      .then(response => response.json())
      .then(response => {
        for (let i = 0; i < response["data"].length; i++) {
          inputFilesInfo[i][6] = getOpinion(response["data"][i][0]);
          inputFilesInfo[i][7] = getOpinion(response["data"][i][1]);
        }
        dTable = $('#upload-table').DataTable({
          dom: '<"html5buttons"B>lTfgitp',
          destroy: true,
          select: true,
          processing: true,
          pagingType: "full_numbers",
          columns: [
            { title: "Index" },
            { title: "Filename" },
            { title: "Size" },
            { title: "Duration" },
            { title: "Height" },
            { title: "Width" },
            { title: "Technical" },
            { title: "Aesthetic" },
          ],
          data: inputFilesInfo,
          bLengthChange: false,
        });
      });
  }
}
