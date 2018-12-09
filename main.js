function $(id) { return document.getElementById(id); }

window.onload = function(){
  $('input').onkeyup = update;
  $('XMLmode').onclick = update;
  $('HTMLmode').onclick = update;
}

function token(str) {
  var len = str.length;
  return function(target, position) {
    if (target.substr(position, len) === str) {
      return {success:true, result:str, position:position + len};
    } else {
      return {success:false, result:null, position:position};
    }
  };
}
function many(parser) {
  return function(target, position) {
    var result = [];
    while(true) {
      var parsed = parser(target, position);
      // 受け取ったパーサが成功したら
      if (parsed.success) {
        result.push(parsed.result); // 結果を格納して
        position = parsed.position;   // 読み取り位置を更新する
      } else {
        break;
      }
    }
    return {success:true, result:result, position:position};
  }
}
function choice(/* parsers... */) {
  var parsers = arguments;
  return function(target, position) {
    for (var i = 0; i < parsers.length; i++) {
      var parsed = parsers[i](target, position);
      // パース成功したら結果をそのまま帰す
      if (parsed.success) {
        return parsed;
      }
    }
    return {success:false, result:null, position:position};
  };
}
function seq(/* parsers... */) {
  var parsers = arguments;
  return function(target, position) {
    var result = [];
    for (var i = 0; i < parsers.length; i++) {
      var parsed = parsers[i](target, position);
      if (parsed.success) {
        result.push(parsed.result);
        position = parsed.position;
      } else {
        // 一つでも失敗を返せば、このパーサ自体が失敗を返す
        return {success:false, result:null, position:position};
      }
    }
    return {success:true, result:result, position:position};
  };
}
function option(parser) {
  return function(target, position) {
    var result = parser(target, position);
    if (result.success) {
      return result;
    } else {
      return {success:true, result:null, position:position};
    }
  };
}
function regex(regexp) {
  if (regexp.source.substring(0, 1) !== '^') {
    regexp = new RegExp(
      '^' + regexp.source,
      (regexp.global ? 'g' : '') +
      (regexp.ignoreCase ? 'i' : '') +
      (regexp.multiline ? 'm' : '')
    );
  }

  return function(target, position) {
    regexp.lastIndex = 0;
    var regexResult = regexp.exec(target.slice(position));

    if (regexResult) {
      position += regexResult[0].length;
      return {success:true, result:regexResult[0], position:position};
    } else {
      return {success:false, result:null, position:position};
    }
  };
}
function lazy(callback) {
  var parse;
  return function(target, position) {
    if (!parse) {
      parse = callback();
    }
    return parse(target, position);
  };
}
function map(parser, fn) {
  return function(target, position) {
    var result = parser(target, position);
    if (result.success) {
      return {success:result.success, result:fn(result.result), position:result.position};
    } else {
      return result;
    }
  };
}

var tagname = regex(/[^\s\[\{]+/);//regex(/[a-zA-Z][a-zA-Z0-9]*/);
var attitude = regex(/[^\]]*/);
var textNode = map(regex(/([^\[\]\{\}\\]|\\\[|\\\]|\\\{|\\\}|\\\\)+/),
  function(result){
    result = result
      .split("\\[").join("[")
      .split("\\]").join("]")
      .split("\\{").join("{")
      .split("\\}").join("}")
      .split("\\\\").join("\\");
    return {raw:result, parsed:result};
  });
var myNode = map(seq(
  token("\\"), tagname,
  option(seq(regex(/\s*\[/), attitude, regex(/\]/))),
  option(seq(regex(/\s*\{/), lazy(()=>content), regex(/\}/)))),
  function (result) {
    var raw = result[0] + result[1] +
      (result[2] ? result[2].join("") : "") +
      (result[3] ? result[3][1] + result[3][2].raw + result[3][3] : "");

    var parsed = "<" + result[1] + (result[2] ? " " + result[2][1] : "") + ">";
    if($('XMLmode').checked) {
      parsed += (result[3] ? result[3][1].parsed : "") + "</" + result[1] + ">";
      return {raw, parsed};
    }
    switch(result[1]){
      case 'area':
      case 'base':
      case 'br':
      case 'col':
      case 'embed':
      case 'hr':
      case 'img':
      case 'input':
      case 'keygen':
      case 'link':
      case 'meta':
      case 'param':
      case 'source':
      case 'track':
      case 'wbr':
        return {raw, parsed};
      case 'style':
      case 'script':
        parsed += (result[3] ? result[3][1].raw : "") + "</" + result[1] + ">";
        return {raw, parsed};
      default:
        parsed += (result[3] ? result[3][1].parsed : "") + "</" + result[1] + ">";
        return {raw, parsed};
    }
  });
var content = map(many(choice(textNode, myNode)),
  function(result) {
    return {
      raw:result.map(x=>x.raw).join(''),
      parsed:result.map(x=>x.parsed).join('')
    };
  });

function update() {
  var input = $('input').value;
  var output = content(input, 0).result.parsed;
  $('htmlOutput').innerText = output;
  $('visualOutput').innerHTML = output;
}
