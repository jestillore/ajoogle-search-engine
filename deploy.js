var shell = require('shelljs');

if (!shell.which('git')) {
    shell.echo('Sorry, this script requires git');
    shell.exit(1);
}

shell.exec('git remote show', { silent: true }, (code, stdout, stderr) => {
    var remotes = stdout.split('\n').filter((item) => {
        return item != ''
    })

    for (var i = 0; i < remotes.length; i++) {
        var push = `git push ${remotes[i]} master`
        console.log(push)
        shell.exec(push, { async: true })
    }

})
