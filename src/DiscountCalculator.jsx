import { useState } from "react";
import "./DiscountCalculator.css";

// Справочник категорий: id -> { label, discount }
// discount хранится в процентах (число)
const CATEGORIES = [
  { id: "electronics", label: "Электроника", discount: 5 },
  { id: "clothing",    label: "Одежда",      discount: 15 },
  { id: "groceries",   label: "Продукты",    discount: 10 },
  { id: "books",       label: "Книги",       discount: 20 },
  { id: "other",       label: "Другое",      discount: 0 },
];

// Ставка НДС в долях (22%)
const VAT_RATE = 0.22;

// Промокод и его дополнительная скидка (в процентах, поверх основной)
const PROMO_CODE = "WELCOME10";
const PROMO_DISCOUNT = 10;

// Границы ползунка кастомной скидки
const CUSTOM_DISCOUNT_MAX = 50;

// Сколько последних расчётов храним в истории
const HISTORY_LIMIT = 5;

let nextId = 1;
function createItem(category = "electronics") {
  return { id: nextId++, price: "", category };
}

function formatRub(value) {
  return value.toLocaleString("ru-RU", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

// Проверка цены одной позиции; возвращает текст ошибки или ""
function validatePrice(price) {
  if (!price.trim()) return "Введите цену товара";
  const num = parseFloat(price);
  if (isNaN(num) || num <= 0) return "Цена должна быть положительным числом";
  return "";
}

function isPromoValid(promo) {
  return promo.trim().toUpperCase() === PROMO_CODE;
}

// Все вычисления в одном месте: используется и для вывода, и для истории
function calculate(items, { useCustomDiscount, customDiscount, promoApplied, withVat }) {
  const promoPercent = promoApplied ? PROMO_DISCOUNT : 0;

  const rows = items.map((it) => {
    const cat = CATEGORIES.find((c) => c.id === it.category);
    const price = parseFloat(it.price) || 0;
    // Кастомная скидка заменяет скидку категории
    const basePercent = useCustomDiscount ? customDiscount : cat ? cat.discount : 0;
    const discountPercent = basePercent + promoPercent;
    const discountAmount = price * (discountPercent / 100);
    return {
      id: it.id,
      label: cat?.label,
      price,
      discountPercent,
      afterDiscount: price - discountAmount,
      baseDiscount: price * (basePercent / 100),
      promoDiscount: price * (promoPercent / 100),
    };
  });

  const subtotal           = rows.reduce((s, r) => s + r.price, 0);
  const baseDiscountTotal  = rows.reduce((s, r) => s + r.baseDiscount, 0);
  const promoDiscountTotal = rows.reduce((s, r) => s + r.promoDiscount, 0);
  const priceAfterDiscount = subtotal - baseDiscountTotal - promoDiscountTotal;
  // НДС начисляется после скидки и только если включён
  const vatAmount          = withVat ? priceAfterDiscount * VAT_RATE : 0;
  const total              = priceAfterDiscount + vatAmount;

  return {
    rows,
    subtotal,
    baseDiscountTotal,
    promoDiscountTotal,
    priceAfterDiscount,
    vatAmount,
    total,
  };
}

function pluralItems(n) {
  const mod10 = n % 10;
  const mod100 = n % 100;
  if (mod10 === 1 && mod100 !== 11) return "товар";
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return "товара";
  return "товаров";
}

function DiscountCalculator() {
  // --- Состояние ---
  const [items, setItems] = useState(() => [createItem()]);
  const [errors, setErrors] = useState({});            // id позиции -> текст ошибки
  const [promo, setPromo] = useState("");              // введённый промокод
  const [useCustomDiscount, setUseCustomDiscount] = useState(false);
  const [customDiscount, setCustomDiscount] = useState(0); // 0..50 %
  const [withVat, setWithVat] = useState(true);        // начислять ли НДС
  const [calculated, setCalculated] = useState(false); // показывать ли результат
  const [history, setHistory] = useState([]);          // последние расчёты

  const promoApplied = isPromoValid(promo);
  const promoInvalid = promo.trim() !== "" && !promoApplied;

  // --- Обработчики ---
  function updateItem(id, patch) {
    setItems((prev) => prev.map((it) => (it.id === id ? { ...it, ...patch } : it)));
    setErrors((prev) => ({ ...prev, [id]: "" }));
    setCalculated(false);
  }

  function handlePriceChange(id, value) {
    // Разрешаем пустую строку и числа с одной точкой
    if (value === "" || /^\d*\.?\d*$/.test(value)) {
      updateItem(id, { price: value });
    }
  }

  function addItem() {
    setItems((prev) => [...prev, createItem("other")]);
    setCalculated(false);
  }

  function removeItem(id) {
    setItems((prev) => prev.filter((it) => it.id !== id));
    setErrors((prev) => {
      const rest = { ...prev };
      delete rest[id];
      return rest;
    });
    setCalculated(false);
  }

  function handlePromoChange(e) {
    setPromo(e.target.value);
    setCalculated(false);
  }

  function handleCustomToggle(e) {
    setUseCustomDiscount(e.target.checked);
    setCalculated(false);
  }

  function handleCustomDiscountChange(e) {
    setCustomDiscount(Number(e.target.value));
    setCalculated(false);
  }

  function handleVatToggle(e) {
    setWithVat(e.target.checked);
    setCalculated(false);
  }

  function handleCalculate() {
    const newErrors = {};
    for (const it of items) {
      const err = validatePrice(it.price);
      if (err) newErrors[it.id] = err;
    }
    setErrors(newErrors);

    if (Object.keys(newErrors).length > 0) {
      setCalculated(false);
      return;
    }

    setCalculated(true);

    // Сохраняем снимок расчёта в историю (новые — сверху, не больше 5)
    const snapshot = calculate(items, { useCustomDiscount, customDiscount, promoApplied, withVat });
    const entry = {
      id: Date.now(),
      time: new Date().toLocaleTimeString("ru-RU"),
      itemsCount: items.length,
      discount: snapshot.baseDiscountTotal + snapshot.promoDiscountTotal,
      total: snapshot.total,
      withVat,
      promoApplied,
    };
    setHistory((prev) => [entry, ...prev].slice(0, HISTORY_LIMIT));
  }

  function handleReset() {
    setItems([createItem()]);
    setErrors({});
    setPromo("");
    setUseCustomDiscount(false);
    setCustomDiscount(0);
    setWithVat(true);
    setCalculated(false);
  }

  // --- Вычисления ---
  const result = calculate(items, { useCustomDiscount, customDiscount, promoApplied, withVat });

  // --- Разметка ---
  return (
    <div className="calculator-wrapper">
      <h2 className="calculator-title">Калькулятор скидок</h2>

      {/* Список товаров */}
      {items.map((it, index) => {
        const error = errors[it.id];
        return (
          <fieldset key={it.id} className="item">
            <legend className="item__legend">
              Товар {index + 1}
              {items.length > 1 && (
                <button
                  type="button"
                  className="item__remove"
                  onClick={() => removeItem(it.id)}
                  aria-label={`Удалить товар ${index + 1}`}
                >
                  ×
                </button>
              )}
            </legend>

            <div className="field">
              <label htmlFor={`price-${it.id}`} className="field__label">
                Цена товара (₽)
              </label>
              <input
                id={`price-${it.id}`}
                type="text"
                className={`field__input ${error ? "field__input--error" : ""}`}
                value={it.price}
                onChange={(e) => handlePriceChange(it.id, e.target.value)}
                placeholder="Например: 1000"
                inputMode="decimal"
              />
              {error && <span className="field__error">{error}</span>}
            </div>

            <div className="field">
              <label htmlFor={`category-${it.id}`} className="field__label">
                Категория товара
              </label>
              <select
                id={`category-${it.id}`}
                className="field__input field__select"
                value={it.category}
                onChange={(e) => updateItem(it.id, { category: e.target.value })}
                disabled={useCustomDiscount}
              >
                {CATEGORIES.map((cat) => (
                  <option key={cat.id} value={cat.id}>
                    {cat.label} — скидка {cat.discount}%
                  </option>
                ))}
              </select>
            </div>
          </fieldset>
        );
      })}

      <button type="button" className="btn btn--add" onClick={addItem}>
        + Добавить товар
      </button>

      {/* Промокод */}
      <div className="field">
        <label htmlFor="promo" className="field__label">
          Промокод
        </label>
        <input
          id="promo"
          type="text"
          className={`field__input ${promoInvalid ? "field__input--error" : ""} ${
            promoApplied ? "field__input--success" : ""
          }`}
          value={promo}
          onChange={handlePromoChange}
          placeholder={PROMO_CODE}
          autoComplete="off"
        />
        {promoApplied && (
          <span className="field__hint field__hint--success">
            Промокод применён: −{PROMO_DISCOUNT}% дополнительно
          </span>
        )}
        {promoInvalid && <span className="field__error">Промокод не найден</span>}
      </div>

      {/* Кастомная скидка */}
      <div className="field">
        <label className="toggle">
          <input type="checkbox" checked={useCustomDiscount} onChange={handleCustomToggle} />
          Своя скидка вместо категорийной
        </label>
        {useCustomDiscount && (
          <div className="range">
            <input
              type="range"
              className="range__input"
              min="0"
              max={CUSTOM_DISCOUNT_MAX}
              step="1"
              value={customDiscount}
              onChange={handleCustomDiscountChange}
              aria-label="Размер скидки"
            />
            <span className="range__value">{customDiscount}%</span>
          </div>
        )}
      </div>

      {/* Переключатель НДС */}
      <div className="field">
        <label className="toggle">
          <input type="checkbox" checked={withVat} onChange={handleVatToggle} />
          Начислять НДС {VAT_RATE * 100}%
        </label>
      </div>

      {/* Кнопки */}
      <div className="actions">
        <button
          type="button"
          className="btn btn--primary"
          onClick={handleCalculate}
        >
          Рассчитать
        </button>
        <button
          type="button"
          className="btn btn--secondary"
          onClick={handleReset}
        >
          Сбросить
        </button>
      </div>

      {/* Результаты */}
      {calculated && (
        <div className="results">
          <h3 className="results__title">Результат расчёта</h3>
          <table className="results__table">
            <tbody>
              {result.rows.map((r, index) => (
                <tr key={r.id}>
                  <td>
                    {index + 1}. {useCustomDiscount ? "Товар" : r.label}:{" "}
                    {formatRub(r.price)} ₽, скидка {r.discountPercent}%
                  </td>
                  <td className="results__value">
                    {formatRub(r.afterDiscount)} ₽
                  </td>
                </tr>
              ))}
              <tr className="results__row--sep">
                <td>Сумма без скидок</td>
                <td className="results__value">{formatRub(result.subtotal)} ₽</td>
              </tr>
              <tr>
                <td>
                  {useCustomDiscount
                    ? `Своя скидка (${customDiscount}%)`
                    : "Скидка по категориям"}
                </td>
                <td className="results__value results__value--discount">
                  −{formatRub(result.baseDiscountTotal)} ₽
                </td>
              </tr>
              {promoApplied && (
                <tr>
                  <td>Промокод {PROMO_CODE} ({PROMO_DISCOUNT}%)</td>
                  <td className="results__value results__value--discount">
                    −{formatRub(result.promoDiscountTotal)} ₽
                  </td>
                </tr>
              )}
              <tr>
                <td>Цена после скидки</td>
                <td className="results__value">
                  {formatRub(result.priceAfterDiscount)} ₽
                </td>
              </tr>
              <tr>
                <td>НДС ({withVat ? `${VAT_RATE * 100}%` : "не начисляется"})</td>
                <td className="results__value">+{formatRub(result.vatAmount)} ₽</td>
              </tr>
              <tr className="results__row--total">
                <td>Итого к оплате</td>
                <td className="results__value">{formatRub(result.total)} ₽</td>
              </tr>
            </tbody>
          </table>
        </div>
      )}

      {/* История расчётов */}
      {history.length > 0 && (
        <div className="history">
          <div className="history__header">
            <h3 className="results__title">Последние расчёты</h3>
            <button
              type="button"
              className="history__clear"
              onClick={() => setHistory([])}
            >
              Очистить
            </button>
          </div>
          <ol className="history__list">
            {history.map((h) => (
              <li key={h.id} className="history__item">
                <span className="history__meta">
                  {h.time} · {h.itemsCount} {pluralItems(h.itemsCount)} · скидка{" "}
                  {formatRub(h.discount)} ₽
                  {h.promoApplied && " · промокод"}
                  {!h.withVat && " · без НДС"}
                </span>
                <span className="history__total">{formatRub(h.total)} ₽</span>
              </li>
            ))}
          </ol>
        </div>
      )}
    </div>
  );
}

export default DiscountCalculator;
