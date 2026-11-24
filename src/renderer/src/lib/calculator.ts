import Big from 'big.js';
import { MAX_AMOUNT_CENTS } from '@shared/money';

Big.DP = 20;
Big.RM = Big.roundHalfUp;

export type CalculationResult =
  | { ok: true; amount: string }
  | { ok: false; error: string };

type Token =
  | { type: 'number'; value: string }
  | { type: 'operator'; value: '+' | '-' | '*' | '/' }
  | { type: 'lparen' }
  | { type: 'rparen' };

class CalcError extends Error {}

function normalizeExpression(raw: string): string {
  return raw
    .normalize('NFKC')
    .replace(/[,\s¥￥]/g, '')
    .replace(/×/g, '*')
    .replace(/÷/g, '/')
    .replace(/−/g, '-');
}

function tokenize(raw: string): Token[] {
  const source = normalizeExpression(raw);
  const tokens: Token[] = [];
  let index = 0;
  let previous: Token | null = null;

  while (index < source.length) {
    const character = source[index];

    if (/[\d.]/.test(character)) {
      const start = index;
      let dotSeen = false;
      while (index < source.length && /[\d.]/.test(source[index])) {
        if (source[index] === '.') {
          if (dotSeen) throw new CalcError('算式格式不正确');
          dotSeen = true;
        }
        index += 1;
      }
      const value = source.slice(start, index);
      if (!/^(?:\d+(?:\.\d*)?|\.\d+)$/.test(value)) {
        throw new CalcError('算式格式不正确');
      }
      const token: Token = { type: 'number', value };
      tokens.push(token);
      previous = token;
      continue;
    }

    if ('+-*/'.includes(character)) {
      const operator = character as '+' | '-' | '*' | '/';
      const isUnary = previous === null || previous.type === 'lparen';
      if ((operator === '+' || operator === '-') && isUnary) {
        const token: Token = { type: 'operator', value: operator };
        tokens.push(token);
        previous = token;
        index += 1;
        continue;
      }
      if (!previous || previous.type === 'operator' || previous.type === 'lparen') {
        throw new CalcError('算式格式不正确');
      }
      const token: Token = { type: 'operator', value: operator };
      tokens.push(token);
      previous = token;
      index += 1;
      continue;
    }

    if (character === '(') {
      if (previous && previous.type === 'number') {
        throw new CalcError('算式格式不正确');
      }
      const token: Token = { type: 'lparen' };
      tokens.push(token);
      previous = token;
      index += 1;
      continue;
    }

    if (character === ')') {
      if (!previous || previous.type === 'operator' || previous.type === 'lparen') {
        throw new CalcError('算式格式不正确');
      }
      const token: Token = { type: 'rparen' };
      tokens.push(token);
      previous = token;
      index += 1;
      continue;
    }

    throw new CalcError('算式格式不正确');
  }

  if (tokens.length === 0) {
    throw new CalcError('请输入算式');
  }
  if (previous?.type === 'operator' || previous?.type === 'lparen') {
    throw new CalcError('算式不完整');
  }
  return tokens;
}

function evaluate(tokens: Token[]): Big {
  let index = 0;

  const peek = (): Token | undefined => tokens[index];

  const parseExpression = (): Big => {
    let value = parseTerm();
    while (true) {
      const operator = peek();
      if (
        operator?.type !== 'operator' ||
        (operator.value !== '+' && operator.value !== '-')
      ) {
        break;
      }
      index += 1;
      const right = parseTerm();
      value = operator.value === '+' ? value.plus(right) : value.minus(right);
    }
    return value;
  };

  const parseTerm = (): Big => {
    let value = parseFactor();
    while (true) {
      const operator = peek();
      if (
        operator?.type !== 'operator' ||
        (operator.value !== '*' && operator.value !== '/')
      ) {
        break;
      }
      index += 1;
      const right = parseFactor();
      if (operator.value === '/') {
        if (right.eq(0)) throw new CalcError('不能除以 0');
        value = value.div(right);
      } else {
        value = value.times(right);
      }
    }
    return value;
  };

  const parseFactor = (): Big => {
    const token = peek();
    if (!token) throw new CalcError('算式不完整');

    if (token.type === 'operator') {
      if (token.value !== '+' && token.value !== '-') {
        throw new CalcError('算式格式不正确');
      }
      index += 1;
      const value = parseFactor();
      return token.value === '-' ? value.times(-1) : value;
    }

    if (token.type === 'number') {
      index += 1;
      try {
        return new Big(token.value);
      } catch {
        throw new CalcError('算式格式不正确');
      }
    }

    if (token.type === 'lparen') {
      index += 1;
      const value = parseExpression();
      if (peek()?.type !== 'rparen') {
        throw new CalcError('括号不完整');
      }
      index += 1;
      return value;
    }

    throw new CalcError('算式格式不正确');
  };

  const result = parseExpression();
  if (index < tokens.length) {
    throw new CalcError('算式格式不正确');
  }
  return result;
}

export function calculateAmountExpression(expression: string): CalculationResult {
  try {
    const value = evaluate(tokenize(expression));
    if (value.lt(0)) {
      return { ok: false, error: '金额不能为负数' };
    }
    if (value.times(100).gt(MAX_AMOUNT_CENTS)) {
      return { ok: false, error: '金额过大' };
    }
    return { ok: true, amount: value.round(2, Big.roundHalfUp).toFixed(2) };
  } catch (error) {
    if (error instanceof CalcError) {
      return { ok: false, error: error.message };
    }
    return { ok: false, error: '算式格式不正确' };
  }
}
