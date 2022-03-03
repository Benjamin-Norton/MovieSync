let logged_in_user
let socket
let file
let uploaderInterval
let numChunks
let startUpload = false
let connected = false
let host = false
let data = {time: 0, pause: false}

document.addEventListener('DOMContentLoaded', () => {
    const ipField = document.getElementById('ipinput')
    const portField = document.getElementById('portinput')
    const nameField = document.getElementById('nameinput')
    const fileInput = document.getElementById('fileinput')

    const fileInputButton = document.getElementById('fileinputbutton')
    const connectButton = document.getElementById('connectbutton')
    const hostButton = document.getElementById('hostbutton')
    const uploadButton = document.getElementById('uploadbutton')
    const downloadButton = document.getElementById('downloadbutton')
    const startButton = document.getElementById('startbutton')

    const errorLabel = document.getElementById('errorlabel')
    const ipLabel = document.getElementById('iplabel')
    const statusLabel = document.getElementById('statuslabel')
    const nameLabel = document.getElementById('namelabel')
    const fileLabel = document.getElementById('filelabel')
    const clientCountLabel = document.getElementById('clientcountlabel')
    const pausedLabel = document.getElementById('pausedlabel')
    const timestampLabel = document.getElementById('timestamplabel')

    const serverTable = document.getElementById('servertable')
    const nameTable = document.getElementById('nametable')

    const containers = document.getElementsByClassName('Container')
    const clientCountBox = document.getElementById('clientcountbox')

    const progress = document.getElementById('progress')
    const progressBar = document.getElementById('progressbar')

    const player = document.getElementById('videoplayer')

    window.onbeforeunload = function() {
        if (connected) socket.send("d,-")
    }

    function startConnection(host) {
        try {
            startServer(ipField.value, portField.value, () => {
                if (connected) {
                    socket.send(host ? "h,-" : "c,-")
                    serverTable.style.display = "none"
                    ipLabel.innerText = `${ipField.value}:${portField.value}`
                    statusLabel.innerText = host ? "Host" : "Client"
                    downloadButton.disabled = true;
                    if(host) {
                        nameTable.style.display = "table"
                    } else {
                        uploadButton.style.display = "none"
                        fileInputButton.style.marginRight = 0
                        for (let container of containers) {
                            container.style.display = "block"
                        }
                        socket.send("ng,-")
                    }
                } else {
                    errorLabel.style.display = "block"
                    errorLabel.textContent = "Cannot Connect to Server"
                }
            })
        } catch (err) {
            errorLabel.style.display = "block"
            errorLabel.textContent = "Invalid Server Address"
        }
    }

    function reset(message) {
        serverTable.style.display = "table"
        nameTable.style.display = "none"
        player.style.display = "none"
        for (let container of containers) {
            container.style.display = "none"
        }
        errorLabel.style.display = "block"
        if(message) {
            errorLabel.textContent = message
        }
    }

    function startServer(ip, port, callback) {
        socket = new WebSocket(`ws://${ip}:${port}`)

        socket.binaryType = "arraybuffer"

        socket.onerror = () => {
            connected = false
            callback()
        }

        socket.onopen = () => {
            connected = true
            callback()
        }

        socket.onclose = () => {
            reset("Connection Closed")
            connected = false
        }

        socket.onmessage = (event) => {
            if (event.data === "q") {
                console.warn("Server Issued Disconnect")
                socket.close()
            } else if (event.data === "d") {
                console.warn("Host Disconnected")
                socket.close()
            } else if (event.data === "sh") {
                console.log("Successfully Connected as Host")
                host = true
            } else if (event.data === "sc") {
                console.log("Successfully Connected as Client")
            } else if (event.data === "fc") {
                console.error("Failed to Connect as Client")
                reset("Server has no Host")
            } else if (event.data === "fh") {
                console.error("Failed to Connect as Host")
                reset("Server Already has a Host")
            } else if (event.data.startsWith("nc")) {
                console.log(`New Client Connected: ${event.data.substring(3)}`)
                clientCountLabel.innerText = parseInt(clientCountLabel.innerText) + 1
            } else if (event.data.startsWith("dc")) {
                console.log(`Client Disconnected: ${event.data.substring(3)}`)
                clientCountLabel.innerText = parseInt(clientCountLabel.innerText) - 1
            } else if (event.data.startsWith("cd")) {
                console.log("Download File Uploaded by Host")
                fileLabel.innerText = event.data.substring(3)
                downloadButton.disabled = false
            } else if (event.data.startsWith("dd")) {
                console.log("Download File Being Uploaded by Host")
                fileLabel.innerText = event.data.substring(3)
                downloadButton.disabled = true
            } else if (event.data.startsWith("us")) {
                let sliceProgress = parseInt(event.data.substring(3))
                console.log(`Slice ${sliceProgress} written`)
                let percentDone = Math.min(100, sliceProgress / numChunks * 100)
                progressBar.style.width = `${percentDone}%`
                if (percentDone >= 100) {
                    progress.style.display = "none"
                    progressBar.style.width = `0%`
                    uploadButton.disabled = false;
                }
            } else if (event.data.startsWith('n')) {
                nameLabel.innerText = event.data.substring(2)
                console.log("Server Name Set")
            } else if (event.data.startsWith("u")) {
                let text = event.data.substring(2)
                let clientData = text.split('|')
                data.pause = clientData[1] === '1'
                data.time = parseFloat(clientData[0])
                player.currentTime = parseFloat(data.time)
                timestampLabel.innerText =  new Date(data.time * 1000).toISOString().substr(11, 8)
                pausedLabel.innerText = data.pause ? "True" : "False"
                if (data.pause) {
                    player.pause()
                } else if (player.paused) {
                    player.play()
                }
            } else {
                console.log(`Unknown Command: ${event.data}`)
            }
        }
    }

    chrome.runtime.sendMessage({text: "getemail"}, (response) => {
        logged_in_user = response.email
    })

    connectButton.addEventListener('click', () => {
        console.log(`Connecting to: ${ipField.value}:${portField.value}`)
        startConnection(false)
    })

    hostButton.addEventListener('click', () => {
        console.log(`Hosting Connection to: ${ipField.value}:${portField.value}`)
        startConnection(true)
    })

    startButton.addEventListener('click', () => {
        nameTable.style.display = "none"
        nameLabel.textContent = nameField.value
        clientCountBox.style.display = "flex"
        for (let container of containers) {
            container.style.display = "block"
        }
        socket.send(`ns,${nameField.value}`)
    })

    fileInputButton.addEventListener('click', () => {
        fileInput.click()
    })

    fileInput.addEventListener('change', () => {
        file = fileInput.files[0]
        fileInputButton.value = file.name === "" ? "Video File" : file.name
        fileInputButton.style.color = file.name === "" ? 'grey' : 'white'

        if (file && file.name !== "") {
            player.src = URL.createObjectURL(file)
            player.style.objectFit = "cover"
            player.style.display = "block"
            uploaderInterval = setInterval(upload, 1000)
            if (host) {
                player.setAttribute("controls", "controls")
            }
        }
    })


    function upload() {
        if(!startUpload) return
        let sliceSize = 1000 * 1024
        numChunks = Math.ceil(file.size / sliceSize)
        let count = 0
        function uploadNextSlice(start) {
            count++
            let nextSlice = Math.min(start + sliceSize, file.size)
            console.log(`Uploading Slice ${count}/${numChunks}`)
            let blob = file.slice(start, nextSlice)
            let reader = new FileReader()
            reader.onloadend = (event) => {
                if(event.target.readyState !== FileReader.DONE) {
                    return
                }
                let binaryFileData = event.target.result

                socket.send(binaryFileData)

                if(nextSlice < file.size) {
                    uploadNextSlice(nextSlice)
                } else {
                    socket.send("ud")
                }
            }
            reader.readAsArrayBuffer(blob)
        }
        uploadNextSlice(0)
        clearInterval(uploaderInterval)
    }

    uploadButton.addEventListener('click', () => {
        file = fileInput.files[0]
        if(file && file.name !== "") {
            uploadButton.disabled = true;
            progress.style.display = "block"
            socket.send(`up,${file.size}|${file.name}`)
            startUpload = true
        }
    })

    downloadButton.addEventListener('click', () => {
        const anchor = document.createElement('a')
        anchor.href = `http://${ipField.value}:8000/video/${fileLabel.innerText}`
        anchor.download = fileLabel.innerText
        document.body.appendChild(anchor)
        anchor.click()
        document.body.removeChild(anchor)
    })

    player.addEventListener("pause", () => {
        if (host && connected) {
            console.log("Sending Pause")
            socket.send(`p,${player.currentTime}|1`)
        }
    })

    player.addEventListener("play", () => {
        if (host && connected) {
            console.log("Sending Play")
            socket.send(`p,${player.currentTime}|0`)
        }
    })

    document.addEventListener('contextmenu', (event) => {
        if(connected && !host) {
            event.preventDefault()
        }
    }, false)
})

