const config = require('config')
const MAX_CLIENT = process.env.MAX_CLIENT || config.get('maxClient')

let processes = []

class ProcessManager {

    static canAcceptClient () {
      return processes.length < MAX_CLIENT
    }

    static push(queryProcess) {
        processes.push(queryProcess)
    }

    static getQueryProcess(queryID) {
        for (var i = 0; i < processes.length; i++) {
            if ((queryID * 1) === (processes[i].getQueryId() * 1)) {
                return processes[i]
                break;
            }
        }
    }

    static remove(queryID) {
        for (var i = 0; i < processes.length; i++) {
            if ((queryID * 1) === (processes[i].getQueryId() * 1)) {
                processes.splice(i, 1)
                break;
            }
        }
    }

    static stop(queryID) {
        let p = ProcessManager.getQueryProcess(queryID)
        if (p) p.stop()
        ProcessManager.remove(queryID)
    }

    static count() {
        return processes.length
    }

}

module.exports = ProcessManager
