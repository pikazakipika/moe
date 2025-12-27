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
  var TARGET_AGE = 100; // シミュレーション終了年齢
  var STORAGE_KEY = 'assetProjectionData'; // localStorage用キー
  var PENSION_START_AGE = 65; // 年金受給開始年齢
  var PENSION_HUSBAND_MONTHLY = 170000; // 夫の年金月額（概算）
  var PENSION_WIFE_MONTHLY = 130000; // 妻の年金月額（概算）

  // ============================================
  // 収入計算（単年）
  // ============================================
  function calculateYearlyIncome(input, husbandAge, wifeAge) {
    var husbandGross = input.husbandIncome || 0;
    var wifeGross = input.wifeIncome || 0;
    var husbandRetireAge = input.husbandRetireAge || 65;
    var wifeRetireAge = input.wifeRetireAge || 60;

    // 退職後は給与0
    if (husbandAge >= husbandRetireAge) {
      husbandGross = 0;
    }
    if (wifeAge >= wifeRetireAge) {
      wifeGross = 0;
    }

    // 年金収入（65歳以降）
    var husbandPension = 0;
    var wifePension = 0;
    if (husbandAge >= PENSION_START_AGE) {
      husbandPension = PENSION_HUSBAND_MONTHLY * 12;
    }
    if (wifeAge >= PENSION_START_AGE) {
      wifePension = PENSION_WIFE_MONTHLY * 12;
    }

    var totalGross = husbandGross + wifeGross;
    var totalPension = husbandPension + wifePension;
    // 給与は税引き、年金は概算なのでそのまま
    var totalNet = Math.floor(totalGross * (1 - TAX_RATE)) + totalPension;

    return {
      husbandGross: husbandGross,
      wifeGross: wifeGross,
      husbandPension: husbandPension,
      wifePension: wifePension,
      totalGross: totalGross,
      totalPension: totalPension,
      totalNet: totalNet
    };
  }

  // ============================================
  // 支出計算（単年）
  // ============================================
  function calculateYearlyExpense(input) {
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
      monthlyTotal: monthlyTotal,
      yearlyTotal: yearlyTotal,
      annualTotal: annualFromMonthly + yearlyTotal
    };
  }

  // ============================================
  // 100歳までのシミュレーション
  // ============================================
  function runSimulation(input) {
    var currentYear = new Date().getFullYear();
    var husbandBirthYear = input.husbandBirthYear || 1990;
    var wifeBirthYear = input.wifeBirthYear || 1992;
    var currentAssets = input.currentAssets || 0;

    var husbandCurrentAge = currentYear - husbandBirthYear;
    var results = [];
    var assets = currentAssets;

    // 夫が100歳になるまでシミュレーション
    for (var year = currentYear; ; year++) {
      var husbandAge = year - husbandBirthYear;
      var wifeAge = year - wifeBirthYear;

      if (husbandAge > TARGET_AGE) break;

      var income = calculateYearlyIncome(input, husbandAge, wifeAge);
      var expense = calculateYearlyExpense(input);
      var balance = income.totalNet - expense.annualTotal;

      assets += balance;

      // イベント（備考）を生成
      var events = [];
      if (husbandAge === PENSION_START_AGE) {
        events.push('夫 年金開始');
      }
      if (wifeAge === PENSION_START_AGE) {
        events.push('妻 年金開始');
      }

      results.push({
        year: year,
        husbandAge: husbandAge,
        wifeAge: wifeAge,
        income: income.totalNet,
        expense: expense.annualTotal,
        balance: balance,
        assets: assets,
        events: events,
        predicted: {
          income: income,
          expense: expense
        },
        actual: null // 将来の実績データ用
      });
    }

    return results;
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

  function formatMoney(num) {
    // 万円単位で表示
    var man = Math.floor(num / 10000);
    return formatNumber(man) + '万';
  }

  // ============================================
  // localStorage保存・読み込み
  // ============================================
  function saveToStorage(data) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    } catch (e) {
      console.warn('Failed to save to localStorage:', e);
    }
  }

  function loadFromStorage() {
    try {
      var saved = localStorage.getItem(STORAGE_KEY);
      return saved ? JSON.parse(saved) : null;
    } catch (e) {
      console.warn('Failed to load from localStorage:', e);
      return null;
    }
  }

  function restoreFormData() {
    var data = loadFromStorage();
    if (!data) return;

    var form = document.getElementById('inputForm');
    for (var key in data) {
      var input = form.elements[key];
      if (input && data[key]) {
        input.value = data[key];
      }
    }
  }

  // ============================================
  // 結果表示
  // ============================================
  function displayResult(results) {
    var resultSection = document.getElementById('result');
    var totalIncomeEl = document.getElementById('totalIncome');
    var totalExpenseEl = document.getElementById('totalExpense');
    var balanceEl = document.getElementById('balance');

    // 初年度のサマリーを表示
    var firstYear = results[0];
    totalIncomeEl.textContent = formatNumber(firstYear.income);
    totalExpenseEl.textContent = formatNumber(firstYear.expense);
    balanceEl.textContent = (firstYear.balance >= 0 ? '+' : '') + formatNumber(firstYear.balance);

    balanceEl.classList.remove('positive', 'negative');
    balanceEl.classList.add(firstYear.balance >= 0 ? 'positive' : 'negative');

    // 資産推移表を生成
    displayProjectionTable(results);

    resultSection.style.display = 'block';
    resultSection.scrollIntoView({ behavior: 'smooth' });
  }

  function displayProjectionTable(results) {
    var tbody = document.getElementById('projectionBody');
    tbody.innerHTML = '';

    results.forEach(function(row) {
      var tr = document.createElement('tr');

      // 資産がマイナスならハイライト
      if (row.assets < 0) {
        tr.classList.add('negative-row');
      }

      var eventsText = row.events ? row.events.join(', ') : '';

      tr.innerHTML =
        '<td>' + row.year + '</td>' +
        '<td>' + row.husbandAge + '</td>' +
        '<td>' + formatMoney(row.income) + '</td>' +
        '<td>' + formatMoney(row.expense) + '</td>' +
        '<td class="' + (row.balance >= 0 ? 'positive' : 'negative') + '">' +
          (row.balance >= 0 ? '+' : '') + formatMoney(row.balance) + '</td>' +
        '<td class="' + (row.assets >= 0 ? '' : 'negative') + '">' +
          formatMoney(row.assets) + '</td>' +
        '<td class="events">' + eventsText + '</td>';

      tbody.appendChild(tr);
    });
  }

  // ============================================
  // 計算実行
  // ============================================
  function calculate() {
    var input = getFormData();

    // 入力値を保存
    saveToStorage(input);

    var results = runSimulation(input);

    displayResult(results);

    console.log('Simulation results:', results);
  }

  // ============================================
  // イベントリスナー・初期化
  // ============================================
  // ページ読み込み時に保存データを復元
  restoreFormData();

  document.getElementById('inputForm').addEventListener('submit', function(e) {
    e.preventDefault();
    calculate();
  });

})();
