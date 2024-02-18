

function dropdown()
{
    //   document.getElementsByClassName("abctext")[0].style.display="block";

    var elems = document.getElementsByClassName("abctext");
    
    for (i = 0 ; i < elems.length; i++) {
        //elems[i].style.display="block";
        if (elems[i].style.display === 'none') {
            elems[i].style.display = 'block';
            elems[i].style.color = '#333';
            elems[i].style.backgroundColor = '#eee';
            elems[i].style.padding = '20px';
        } else {
            elems[i].style.display = 'none';
        }
    }

}

    
