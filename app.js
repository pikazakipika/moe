/**
 * 資産推移予測ツール - メインアプリケーション
 * 将来の拡張: シミュレーション結果をJSON形式で保持し、予実比較に対応
 */

(function() {
  'use strict';

  // ============================================
  // 定数
  // ============================================
  var TAX_RATE = 0.20; // 税金・社会保険料率（簡易計算）

  // ============================================
  // 収入計算
  // ============================================
  function calculateAnnualIncome(input) {
    var husbandGross = input.husbandIncome || 0;
    var wifeGross = input.wifeIncome || 0;

    var husbandNet = Math.floor(husbandGross * (1 - TAX_RATE));
    var wifeNet = Math.floor(wifeGross * (1 - TAX_RATE));

    return {
      husband: {
        gross: husbandGross,
        net: husbandNet
      },
      wife: {
        gross: wifeGross,
        net: wifeNet
      },
      totalGross: husbandGross + wifeGross,
      totalNet: husbandNet + wifeNet
    };
  }

  // ============================================
  // 支出計算
  // ============================================
  function calculateAnnualExpense(input) {
    // 月額固定支出
    var monthlyExpenses = {
      houseLoan: input.houseLoan || 0,
      carLoan: input.carLoan || 0,
      utilities: input.utilities || 0,
      phone: input.phone || 0,
      wifi: input.wifi || 0,
      husbandAllowance: input.husbandAllowance || 0,
      wifeAllowance: input.wifeAllowance || 0,
      food: input.food || 0,
      medical: input.medical || 0,
      insurance: input.insurance || 0,
      contact: input.contact || 0
    };

    var monthlyTotal = 0;
    for (var key in monthlyExpenses) {
      monthlyTotal += monthlyExpenses[key];
    }
    var annualFromMonthly = monthlyTotal * 12;

    // 年額支出
    var yearlyExpenses = {
      event: input.event || 0,
      ceremony: input.ceremony || 0,
      travel: input.travel || 0,
      celebration: input.celebration || 0
    };

    var yearlyTotal = 0;
    for (var key in yearlyExpenses) {
      yearlyTotal += yearlyExpenses[key];
    }

    return {
      monthly: monthlyExpenses,
      monthlyTotal: monthlyTotal,
      yearly: yearlyExpenses,
      yearlyTotal: yearlyTotal,
      annualTotal: annualFromMonthly + yearlyTotal
    };
  }

  // ============================================
  // ユーティリティ
  // ============================================
  function getFormData() {
    var form = document.getElementById('inputForm');
    var formData = new FormData(form);
    var data = {};

    formData.forEach(function(value, key) {
      data[key] = value ? parseInt(value, 10) : 0;
    });

    return data;
  }

  function formatNumber(num) {
    return num.toLocaleString('ja-JP');
  }

  // ============================================
  // 結果表示
  // ============================================
  function displayResult(income, expense) {
    var resultSection = document.getElementById('result');
    var totalIncomeEl = document.getElementById('totalIncome');
    var totalExpenseEl = document.getElementById('totalExpense');
    var balanceEl = document.getElementById('balance');

    var balance = income.totalNet - expense.annualTotal;

    totalIncomeEl.textContent = formatNumber(income.totalNet);
    totalExpenseEl.textContent = formatNumber(expense.annualTotal);
    balanceEl.textContent = (balance >= 0 ? '+' : '') + formatNumber(balance);

    // 収支に応じてスタイルを変更
    balanceEl.classList.remove('positive', 'negative');
    balanceEl.classList.add(balance >= 0 ? 'positive' : 'negative');

    resultSection.style.display = 'block';

    // 結果までスクロール
    resultSection.scrollIntoView({ behavior: 'smooth' });
  }

  // ============================================
  // 計算実行
  // ============================================
  function calculate() {
    var input = getFormData();
    var income = calculateAnnualIncome(input);
    var expense = calculateAnnualExpense(input);

    displayResult(income, expense);

    // 将来の拡張用: 計算結果をJSON形式で保持
    var result = {
      year: new Date().getFullYear(),
      predicted: {
        income: income,
        expense: expense,
        balance: income.totalNet - expense.annualTotal
      },
      actual: null // 将来の実績データ用
    };

    console.log('Simulation result:', result);
  }

  // ============================================
  // イベントリスナー
  // ============================================
  document.getElementById('inputForm').addEventListener('submit', function(e) {
    e.preventDefault();
    calculate();
  });

})();
