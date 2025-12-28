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

  // 児童手当（月額）
  var CHILD_ALLOWANCE_UNDER_3 = 15000;  // 0〜3歳未満
  var CHILD_ALLOWANCE_NORMAL = 10000;   // 3歳〜高校生
  var CHILD_ALLOWANCE_THIRD = 30000;    // 第3子以降
  var CHILD_ALLOWANCE_END_AGE = 18;     // 高校卒業（18歳）まで

  // 学費（年額）
  var EDUCATION_COST = {
    NURSERY: 50000,      // 保育園（3〜5歳、無償化後の実費）
    ELEMENTARY: 100000,  // 小学校（公立）
    JUNIOR_HIGH: 150000, // 中学校（公立）
    HIGH_SCHOOL: 250000, // 高校（公立）
    UNIVERSITY: 500000   // 大学（私立・奨学金前提で自己負担分）
  };

  // 保育料（0〜2歳、第1子のみ有料）- 年収に応じた概算
  var NURSERY_FEE_MONTHLY = 40000; // 月額概算

  // 食費増加（月額）
  var CHILD_FOOD_COST = {
    UNDER_6: 20000,   // 0〜5歳
    UNDER_13: 30000,  // 6〜12歳
    UNDER_23: 40000   // 13〜22歳
  };

  // 育休給付金
  var MATERNITY_LEAVE_RATE_FIRST = 0.67;  // 180日まで67%
  var MATERNITY_LEAVE_RATE_AFTER = 0.50;  // 以降50%

  // ============================================
  // 子供の年齢リストを取得
  // ============================================
  function getChildAges(input, year) {
    var children = [];
    if (input.child1BirthYear) {
      children.push({ birthYear: input.child1BirthYear, age: year - input.child1BirthYear, order: 1 });
    }
    if (input.child2BirthYear) {
      children.push({ birthYear: input.child2BirthYear, age: year - input.child2BirthYear, order: 2 });
    }
    if (input.child3BirthYear) {
      children.push({ birthYear: input.child3BirthYear, age: year - input.child3BirthYear, order: 3 });
    }
    return children;
  }

  // ============================================
  // 児童手当計算（年額）
  // ============================================
  function calculateChildAllowance(children) {
    var total = 0;
    children.forEach(function(child) {
      if (child.age < 0 || child.age >= CHILD_ALLOWANCE_END_AGE) return;

      var monthly;
      if (child.order >= 3) {
        // 第3子以降は一律3万円
        monthly = CHILD_ALLOWANCE_THIRD;
      } else if (child.age < 3) {
        monthly = CHILD_ALLOWANCE_UNDER_3;
      } else {
        monthly = CHILD_ALLOWANCE_NORMAL;
      }
      total += monthly * 12;
    });
    return total;
  }

  // ============================================
  // 子供の食費増加計算（年額）
  // ============================================
  function calculateChildFoodCost(children) {
    var total = 0;
    children.forEach(function(child) {
      if (child.age < 0 || child.age >= 23) return;

      var monthly;
      if (child.age < 6) {
        monthly = CHILD_FOOD_COST.UNDER_6;
      } else if (child.age < 13) {
        monthly = CHILD_FOOD_COST.UNDER_13;
      } else {
        monthly = CHILD_FOOD_COST.UNDER_23;
      }
      total += monthly * 12;
    });
    return total;
  }

  // ============================================
  // 子供1人あたりの費用計算（食費+保育/学費）
  // ============================================
  function calculateChildCost(child, childIndex) {
    if (child.age < 0) return 0;

    var cost = 0;

    // 食費増加
    if (child.age < 6) {
      cost += CHILD_FOOD_COST.UNDER_6 * 12;
    } else if (child.age < 13) {
      cost += CHILD_FOOD_COST.UNDER_13 * 12;
    } else if (child.age < 23) {
      cost += CHILD_FOOD_COST.UNDER_23 * 12;
    }

    // 保育料・学費
    if (child.age <= 2) {
      // 0〜2歳: 保育料（第1子のみ有料）
      if (childIndex === 0) {
        cost += NURSERY_FEE_MONTHLY * 12;
      }
    } else if (child.age <= 5) {
      // 3〜5歳: 幼稚園/保育園（無償化で実費のみ）
      cost += EDUCATION_COST.NURSERY;
    } else if (child.age <= 11) {
      // 6〜11歳: 小学校
      cost += EDUCATION_COST.ELEMENTARY;
    } else if (child.age <= 14) {
      // 12〜14歳: 中学校
      cost += EDUCATION_COST.JUNIOR_HIGH;
    } else if (child.age <= 17) {
      // 15〜17歳: 高校
      cost += EDUCATION_COST.HIGH_SCHOOL;
    } else if (child.age <= 21) {
      // 18〜21歳: 大学
      cost += EDUCATION_COST.UNIVERSITY;
    }

    return cost;
  }

  // ============================================
  // 保育料・学費計算（年額・合計）
  // ============================================
  function calculateEducationCost(children) {
    var total = 0;
    children.forEach(function(child, index) {
      if (child.age < 0) return;

      // 0〜2歳: 保育料（第1子のみ有料）
      if (child.age <= 2) {
        if (index === 0) {
          total += NURSERY_FEE_MONTHLY * 12;
        }
        // 第2子以降は無料
      }
      // 3〜5歳: 幼稚園/保育園（無償化で実費のみ）
      else if (child.age <= 5) {
        total += EDUCATION_COST.NURSERY;
      }
      // 6〜11歳: 小学校
      else if (child.age <= 11) {
        total += EDUCATION_COST.ELEMENTARY;
      }
      // 12〜14歳: 中学校
      else if (child.age <= 14) {
        total += EDUCATION_COST.JUNIOR_HIGH;
      }
      // 15〜17歳: 高校
      else if (child.age <= 17) {
        total += EDUCATION_COST.HIGH_SCHOOL;
      }
      // 18〜21歳: 大学
      else if (child.age <= 21) {
        total += EDUCATION_COST.UNIVERSITY;
      }
    });
    return total;
  }

  // ============================================
  // 育休給付金計算（その年に出産があるか）
  // ============================================
  function calculateMaternityBenefit(input, year, wifeGross) {
    var children = [input.child1BirthYear, input.child2BirthYear, input.child3BirthYear];
    var isBirthYear = children.some(function(birthYear) {
      return birthYear === year;
    });

    if (!isBirthYear) return { benefit: 0, replacesWifeSalary: false };

    // 育休中は給与の代わりに給付金
    // 180日まで67%、以降50% → 年平均で約58.5%
    var averageRate = (MATERNITY_LEAVE_RATE_FIRST * 6 + MATERNITY_LEAVE_RATE_AFTER * 6) / 12;
    var benefit = Math.floor(wifeGross * averageRate);

    return { benefit: benefit, replacesWifeSalary: true };
  }

  // ============================================
  // 収入計算（単年）
  // ============================================
  function calculateYearlyIncome(input, husbandAge, wifeAge, year, children) {
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

    // 育休給付金チェック（妻が退職前かつ出産年の場合）
    var maternityBenefit = 0;
    if (wifeAge < wifeRetireAge) {
      var maternity = calculateMaternityBenefit(input, year, input.wifeIncome || 0);
      if (maternity.replacesWifeSalary) {
        maternityBenefit = maternity.benefit;
        wifeGross = 0; // 育休中は給与なし
      }
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

    // 児童手当
    var childAllowance = calculateChildAllowance(children);

    var totalGross = husbandGross + wifeGross;
    var totalPension = husbandPension + wifePension;
    // 給与は税引き、年金・児童手当・育休給付金はそのまま
    var totalNet = Math.floor(totalGross * (1 - TAX_RATE)) + totalPension + childAllowance + maternityBenefit;

    return {
      husbandGross: husbandGross,
      wifeGross: wifeGross,
      husbandPension: husbandPension,
      wifePension: wifePension,
      childAllowance: childAllowance,
      maternityBenefit: maternityBenefit,
      totalGross: totalGross,
      totalPension: totalPension,
      totalNet: totalNet
    };
  }

  // ============================================
  // 支出計算（単年）
  // ============================================
  function calculateYearlyExpense(input, children) {
    // 月額固定支出（カテゴリ別）
    var loan = (input.houseLoan || 0) + (input.carLoan || 0);
    var food = input.food || 0;
    var allowance = (input.husbandAllowance || 0) + (input.wifeAllowance || 0);
    var other = (input.utilities || 0) + (input.phone || 0) + (input.wifi || 0) +
                (input.medical || 0) + (input.insurance || 0) + (input.contact || 0);

    var monthlyTotal = loan + food + allowance + other;
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

    // 子供関連費用（子供ごと）
    var child1Cost = children[0] ? calculateChildCost(children[0], 0) : 0;
    var child2Cost = children[1] ? calculateChildCost(children[1], 1) : 0;
    var child3Cost = children[2] ? calculateChildCost(children[2], 2) : 0;
    var totalChildCost = child1Cost + child2Cost + child3Cost;

    return {
      monthlyTotal: monthlyTotal,
      yearlyTotal: yearlyTotal,
      annualTotal: annualFromMonthly + yearlyTotal + totalChildCost,
      // カテゴリ別（月額）
      loan: loan,
      food: food,
      allowance: allowance,
      other: other,
      // 子供ごとの費用（年額）
      child1Cost: child1Cost,
      child2Cost: child2Cost,
      child3Cost: child3Cost,
      totalChildCost: totalChildCost
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

    var results = [];
    var assets = currentAssets;

    // 夫が100歳になるまでシミュレーション
    for (var year = currentYear; ; year++) {
      var husbandAge = year - husbandBirthYear;
      var wifeAge = year - wifeBirthYear;

      if (husbandAge > TARGET_AGE) break;

      // 子供の年齢情報を取得
      var children = getChildAges(input, year);

      var income = calculateYearlyIncome(input, husbandAge, wifeAge, year, children);
      var expense = calculateYearlyExpense(input, children);
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

      // 子供関連イベント
      children.forEach(function(child) {
        var label = '第' + child.order + '子';
        if (child.age === 0) {
          events.push(label + '誕生');
        } else if (child.age === 6) {
          events.push(label + '小学校');
        } else if (child.age === 12) {
          events.push(label + '中学校');
        } else if (child.age === 15) {
          events.push(label + '高校');
        } else if (child.age === 18) {
          events.push(label + '大学');
        } else if (child.age === 22) {
          events.push(label + '卒業');
        }
      });

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

    // 展開状態をリセット（ヘッダーのアイコンも戻す）
    var incomeHeader = document.getElementById('incomeHeader');
    var expenseHeader = document.getElementById('expenseHeader');
    var incomeCols = document.querySelectorAll('.income-detail');
    var expenseCols = document.querySelectorAll('.expense-detail');

    incomeCols.forEach(function(col) { col.classList.remove('show'); });
    expenseCols.forEach(function(col) { col.classList.remove('show'); });
    if (incomeHeader) incomeHeader.querySelector('.expand-icon').textContent = '▶';
    if (expenseHeader) expenseHeader.querySelector('.expand-icon').textContent = '▶';

    results.forEach(function(row) {
      var tr = document.createElement('tr');
      var income = row.predicted.income;
      var expense = row.predicted.expense;

      // 資産がマイナスならハイライト
      if (row.assets < 0) {
        tr.classList.add('negative-row');
      }

      var eventsText = row.events ? row.events.join(', ') : '';

      // 収入詳細（税引後）
      var husbandSalaryNet = Math.floor(income.husbandGross * (1 - TAX_RATE));
      var wifeSalaryNet = Math.floor(income.wifeGross * (1 - TAX_RATE));

      // 児童手当+育休給付金
      var childIncome = (income.childAllowance || 0) + (income.maternityBenefit || 0);

      tr.innerHTML =
        '<td>' + row.year + '</td>' +
        '<td>' + row.husbandAge + '</td>' +
        '<td>' + formatMoney(row.income) + '</td>' +
        '<td class="detail-col income-detail">' + formatMoney(husbandSalaryNet) + '</td>' +
        '<td class="detail-col income-detail">' + formatMoney(wifeSalaryNet) + '</td>' +
        '<td class="detail-col income-detail">' + formatMoney(income.husbandPension) + '</td>' +
        '<td class="detail-col income-detail">' + formatMoney(income.wifePension) + '</td>' +
        '<td class="detail-col income-detail">' + formatMoney(childIncome) + '</td>' +
        '<td>' + formatMoney(row.expense) + '</td>' +
        '<td class="detail-col expense-detail">' + formatMoney(expense.loan * 12) + '</td>' +
        '<td class="detail-col expense-detail">' + formatMoney(expense.food * 12) + '</td>' +
        '<td class="detail-col expense-detail">' + formatMoney(expense.allowance * 12) + '</td>' +
        '<td class="detail-col expense-detail">' + formatMoney(expense.child1Cost || 0) + '</td>' +
        '<td class="detail-col expense-detail">' + formatMoney(expense.child2Cost || 0) + '</td>' +
        '<td class="detail-col expense-detail">' + formatMoney(expense.child3Cost || 0) + '</td>' +
        '<td class="detail-col expense-detail">' + formatMoney(expense.other * 12 + expense.yearlyTotal) + '</td>' +
        '<td class="' + (row.balance >= 0 ? 'positive' : 'negative') + '">' +
          (row.balance >= 0 ? '+' : '') + formatMoney(row.balance) + '</td>' +
        '<td class="' + (row.assets >= 0 ? '' : 'negative') + '">' +
          formatMoney(row.assets) + '</td>' +
        '<td class="events">' + eventsText + '</td>';

      tbody.appendChild(tr);
    });
  }

  // ============================================
  // カラム展開機能
  // ============================================
  function toggleColumns(type) {
    var detailClass = type + '-detail';
    var headerEl = document.getElementById(type + 'Header');
    var iconEl = headerEl.querySelector('.expand-icon');
    var cols = document.querySelectorAll('.' + detailClass);

    var isExpanded = cols[0].classList.contains('show');

    cols.forEach(function(col) {
      if (isExpanded) {
        col.classList.remove('show');
      } else {
        col.classList.add('show');
      }
    });

    iconEl.textContent = isExpanded ? '▶' : '▼';
  }

  function setupColumnToggle() {
    var incomeHeader = document.getElementById('incomeHeader');
    var expenseHeader = document.getElementById('expenseHeader');

    if (incomeHeader) {
      incomeHeader.addEventListener('click', function() {
        toggleColumns('income');
      });
    }

    if (expenseHeader) {
      expenseHeader.addEventListener('click', function() {
        toggleColumns('expense');
      });
    }
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

  // カラム展開機能を設定
  setupColumnToggle();

  document.getElementById('inputForm').addEventListener('submit', function(e) {
    e.preventDefault();
    calculate();
  });

})();
