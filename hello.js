const display = document.querySelector('.display');
const calcButtons = document.querySelectorAll('.buttons button');
const chatForm = document.getElementById('chatForm');
const chatInput = document.getElementById('chatInput');
const chatMessages = document.getElementById('chatMessages');

let expression = '0';
let hasError = false;

const functionNames = ['sin', 'cos', 'tan', 'sqrt', 'log', 'ln', 'abs'];
const operators = ['+', '-', '*', '/', '%', '^'];
const DECIMAL_PLACES = 10;
const PRECEDENCE = { '+': 1, '-': 1, '*': 2, '/': 2, '%': 2, '^': 3, 'u-': 4 };
const RIGHT_ASSOCIATIVE = new Set(['^', 'u-']);

const isDigit = (char) => /\d/.test(char);

function ensureInputReady() {
  if (hasError) {
    expression = '0';
    hasError = false;
  }
}

function render() {
  display.value = expression || '0';
}

function allClear() {
  expression = '0';
  hasError = false;
  render();
}

function appendValue(value) {
  ensureInputReady();
  if (expression === '0' && isDigit(value)) {
    expression = value;
  } else {
    expression += value;
  }
  render();
}

function appendFunction(value) {
  ensureInputReady();
  if (expression === '0') {
    expression = value;
  } else {
    expression += value;
  }
  render();
}

function backspace() {
  ensureInputReady();
  if (expression.length <= 1) {
    expression = '0';
  } else {
    expression = expression.slice(0, -1);
  }
  render();
}

function toggleSign() {
  ensureInputReady();
  const match = expression.match(/(-?\d+(\.\d+)?)$/);
  if (!match) {
    return;
  }
  const target = match[0];
  const toggled = target.startsWith('-') ? target.slice(1) : `-${target}`;
  expression = `${expression.slice(0, -target.length)}${toggled}`;
  render();
}

function normalize(input) {
  return input
    .replace(/\s+/g, '')
    .replace(/÷/g, '/')
    .replace(/×/g, '*')
    .replace(/π/g, 'pi');
}

function tokenize(input) {
  const tokens = [];
  const expr = normalize(input);
  let i = 0;

  while (i < expr.length) {
    const char = expr[i];

    if (/\d|\./.test(char)) {
      let number = char;
      i += 1;
      while (i < expr.length && /[\d.]/.test(expr[i])) {
        number += expr[i];
        i += 1;
      }
      if (Number.isNaN(Number(number))) {
        throw new Error(`Invalid number format: ${number}`);
      }
      tokens.push({ type: 'number', value: Number(number) });
      continue;
    }

    if (/[a-z]/i.test(char)) {
      let word = char;
      i += 1;
      while (i < expr.length && /[a-z]/i.test(expr[i])) {
        word += expr[i];
        i += 1;
      }
      if (functionNames.includes(word)) {
        tokens.push({ type: 'function', value: word });
        continue;
      }
      if (word === 'pi' || word === 'e') {
        tokens.push({ type: 'constant', value: word });
        continue;
      }
      throw new Error(`Unknown function: ${word}`);
    }

    if (operators.includes(char)) {
      tokens.push({ type: 'operator', value: char });
      i += 1;
      continue;
    }

    if (char === '(' || char === ')') {
      tokens.push({ type: 'paren', value: char });
      i += 1;
      continue;
    }

    throw new Error('Invalid character');
  }

  return tokens;
}

function withImplicitMultiplication(tokens) {
  const fixed = [];
  for (let i = 0; i < tokens.length; i += 1) {
    const current = tokens[i];
    const prev = fixed[fixed.length - 1];

    if (
      prev &&
      (
        prev.type === 'number' ||
        prev.type === 'constant' ||
        (prev.type === 'paren' && prev.value === ')')
      ) &&
      (
        current.type === 'function' ||
        current.type === 'constant' ||
        current.type === 'number' ||
        (current.type === 'paren' && current.value === '(')
      )
    ) {
      fixed.push({ type: 'operator', value: '*' });
    }
    fixed.push(current);
  }
  return fixed;
}

function toRpn(tokens) {
  const output = [];
  const stack = [];

  let previous = null;
  for (const token of tokens) {
    if (token.type === 'number' || token.type === 'constant') {
      output.push(token);
    } else if (token.type === 'function') {
      stack.push(token);
    } else if (token.type === 'operator') {
      let op = token.value;
      const isUnaryMinus = op === '-' && (!previous || (previous.type === 'operator') || (previous.type === 'paren' && previous.value === '(') || previous.type === 'function');
      if (isUnaryMinus) {
        op = 'u-';
      }

      while (stack.length) {
        const top = stack[stack.length - 1];
        if (
          top.type === 'operator' &&
          (
            (RIGHT_ASSOCIATIVE.has(op) && PRECEDENCE[op] < PRECEDENCE[top.value]) ||
            (!RIGHT_ASSOCIATIVE.has(op) && PRECEDENCE[op] <= PRECEDENCE[top.value])
          )
        ) {
          output.push(stack.pop());
        } else if (top.type === 'function') {
          output.push(stack.pop());
        } else {
          break;
        }
      }
      stack.push({ type: 'operator', value: op });
    } else if (token.type === 'paren' && token.value === '(') {
      stack.push(token);
    } else if (token.type === 'paren' && token.value === ')') {
      let matched = false;
      while (stack.length) {
        const top = stack.pop();
        if (top.type === 'paren' && top.value === '(') {
          matched = true;
          break;
        }
        output.push(top);
      }
      if (!matched) {
        throw new Error('Unbalanced parentheses');
      }
      if (stack.length && stack[stack.length - 1].type === 'function') {
        output.push(stack.pop());
      }
    }
    previous = token;
  }

  while (stack.length) {
    const top = stack.pop();
    if (top.type === 'paren') {
      throw new Error('Unbalanced parentheses');
    }
    output.push(top);
  }

  return output;
}

function evalRpn(rpn) {
  const stack = [];

  for (const token of rpn) {
    if (token.type === 'number') {
      stack.push(token.value);
      continue;
    }
    if (token.type === 'constant') {
      stack.push(token.value === 'pi' ? Math.PI : Math.E);
      continue;
    }
    if (token.type === 'operator') {
      if (token.value === 'u-') {
        if (!stack.length) {
          throw new Error('Invalid expression');
        }
        stack.push(-stack.pop());
        continue;
      }

      const b = stack.pop();
      const a = stack.pop();
      if (typeof a !== 'number' || typeof b !== 'number') {
        throw new Error('Invalid expression');
      }

      switch (token.value) {
        case '+': stack.push(a + b); break;
        case '-': stack.push(a - b); break;
        case '*': stack.push(a * b); break;
        case '/':
          if (b === 0) throw new Error('Division by zero');
          stack.push(a / b);
          break;
        case '%':
          if (b === 0) throw new Error('Division by zero');
          stack.push(a % b);
          break;
        case '^': stack.push(a ** b); break;
        default: throw new Error('Invalid operator');
      }
      continue;
    }
    if (token.type === 'function') {
      const v = stack.pop();
      if (typeof v !== 'number') {
        throw new Error('Invalid function input');
      }
      switch (token.value) {
        case 'sin': stack.push(Math.sin(v)); break;
        case 'cos': stack.push(Math.cos(v)); break;
        case 'tan': stack.push(Math.tan(v)); break;
        case 'sqrt':
          if (v < 0) throw new Error('Invalid sqrt input');
          stack.push(Math.sqrt(v));
          break;
        case 'log':
          if (v <= 0) throw new Error('Invalid log input');
          stack.push(Math.log10(v));
          break;
        case 'ln':
          if (v <= 0) throw new Error('Invalid ln input');
          stack.push(Math.log(v));
          break;
        case 'abs': stack.push(Math.abs(v)); break;
        default: throw new Error('Invalid function');
      }
    }
  }

  if (stack.length !== 1 || !Number.isFinite(stack[0])) {
    throw new Error('Invalid result');
  }
  return stack[0];
}

function evaluateExpression(input) {
  const tokens = withImplicitMultiplication(tokenize(input));
  const rpn = toRpn(tokens);
  const value = evalRpn(rpn);
  if (Number.isInteger(value)) {
    return String(value);
  }
  const trimmed = value.toFixed(DECIMAL_PLACES).replace(/\.?0+$/, '');
  return trimmed === '-0' ? '0' : trimmed;
}

function calculate() {
  try {
    expression = evaluateExpression(expression);
    hasError = false;
  } catch (error) {
    expression = error instanceof Error ? error.message : 'Error';
    hasError = true;
  }
  render();
}

function addMessage(text, role = 'bot') {
  const message = document.createElement('div');
  message.className = `message ${role}`;
  message.textContent = text;
  chatMessages.appendChild(message);
  chatMessages.scrollTop = chatMessages.scrollHeight;
}

function getChatReply(userText) {
  const text = userText.toLowerCase().trim();

  if (text.includes('calculate')) {
    const candidate = userText.replace(/calculate/i, '').trim();
    if (!candidate) {
      return 'Please provide an expression after "calculate", like calculate 12*(3+4).';
    }
    try {
      return `Result: ${evaluateExpression(candidate)}`;
    } catch (error) {
      const reason = error instanceof Error ? error.message : 'invalid expression';
      return `I could not evaluate that expression: ${reason}.`;
    }
  }

  if (text.includes('sqrt')) {
    return 'Use sqrt(x) for square root. Example: sqrt(81)';
  }
  if (text.includes('power') || text.includes('xʸ') || text.includes('^')) {
    return 'Use ^ for powers. Example: 2^8';
  }
  if (text.includes('trig') || text.includes('sin') || text.includes('cos') || text.includes('tan')) {
    return 'Trig functions are available: sin(x), cos(x), tan(x) where x is in radians.';
  }
  if (text.includes('log')) {
    return 'Use log(x) for base-10 logarithm and ln(x) for natural logarithm.';
  }
  if (text.includes('help')) {
    return 'Supported: +, -, *, /, %, ^, parentheses, π, e, sin, cos, tan, sqrt, log, ln, abs.';
  }

  return 'Try asking: "help", "how to use sqrt?", or "calculate 5*(7+3)".';
}

calcButtons.forEach((button) => {
  button.addEventListener('click', () => {
    const { action, value } = button.dataset;
    if (action === 'append') appendValue(value);
    if (action === 'func') appendFunction(value);
    if (action === 'all-clear') allClear();
    if (action === 'backspace') backspace();
    if (action === 'toggle-sign') toggleSign();
    if (action === 'calculate') calculate();
  });
});

document.addEventListener('keydown', (event) => {
  const key = event.key;
  if (/[\d.+\-*/%^()]/.test(key)) {
    appendValue(key);
  } else if (key === 'Enter') {
    event.preventDefault();
    calculate();
  } else if (key === 'Backspace') {
    backspace();
  } else if (key === 'Delete') {
    allClear();
  }
});

chatForm.addEventListener('submit', (event) => {
  event.preventDefault();
  const query = chatInput.value.trim();
  if (!query) return;
  addMessage(query, 'user');
  addMessage(getChatReply(query), 'bot');
  chatInput.value = '';
});

render();
