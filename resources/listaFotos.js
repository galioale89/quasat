var listaFotos = function(lst) {
    var ehimagem
    var ehpdf
    var lista_fotos = []
    var lista = []
    lista = lst
    lista.forEach((l) => {
        tipo = l.desc
        x = tipo.length
        y = x - 3
        tipo = tipo.slice(y, x)
        //console.log(tipo)
        if (tipo == 'pdf') {
            ehimagem = false
            ehpdf = true
        } else {
            ehimagem = true
            ehpdf = false
        }
        lista_fotos.push({ desc: l.desc, _id: l._id, ehimagem, ehpdf })
    })
    return lista_fotos
}

module.exports = listaFotos
