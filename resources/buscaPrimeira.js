var buscaPrimeira = function (string) {

    var str = string.split(' ')
    var x = ''
    var w = ''
    var p = ''
    var s = ''
    var f = ''
    var u = 0
    for (let i = 0; i < str.length; i++) {
        x = str[i]
        w = x.slice(0, 1)
        p = (w).toUpperCase()
        w = x.slice(1, x.length)
        s = (w).toLowerCase()
        if (str.length > 1) {
            f = f + p + s + ' '
        } else {
            f = p + s
        }
    }

    u = f.length

    f = f.slice(0, u)
    return f
}

module.exports = buscaPrimeira
