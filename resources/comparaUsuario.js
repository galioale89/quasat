var comparaUsuario = function(a,b) {
    if (a.usuario > b.usuario) {
        return 1;
      }
      if (a.usuario < b.usuario) {
        return -1;
      }
      return 0;   
}

module.exports = comparaUsuario
