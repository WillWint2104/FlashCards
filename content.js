// =============================================================================
// Marginal trial content — "Distribution of Income & Wealth" (HSC Economics)
// Original practice questions written for this app. Statistics referenced are
// public ABS / Commonwealth Budget figures. Organised into MASTERY AREAS
// (logical skill groupings), not textbook chapter order.
// Card types: mc (hardcoded) · calc (numeric) · define/short (local grading)
//             essay (LLM-graded via proxy, demo fallback without one)
// =============================================================================
window.CONTENT = {
  subject: "Economics",
  unit: "Distribution of Income and Wealth",
  glossary: {
    "income": "A flow of money and benefits received over a period of time, in return for factors of production or as government transfers.",
    "wealth": "The stock of net assets (real and financial) owned at a point in time.",
    "net worth": "Total assets minus total liabilities — the measure of wealth.",
    "lorenz curve": "A graph plotting cumulative share of income or wealth against cumulative share of the population, used to show inequality.",
    "gini coefficient": "A number between 0 (perfect equality) and 1 (perfect inequality) summarising how far the Lorenz curve sits from the line of perfect equality.",
    "quintile": "One fifth (20%) of the population, ranked from lowest to highest income or wealth.",
    "equivalised disposable income": "Household income after tax, adjusted so households of different sizes and compositions can be compared fairly.",
    "progressive taxation": "A tax system where the rate of tax paid rises as income rises.",
    "marginal tax rate": "The rate of tax paid on the next dollar of income earned.",
    "transfer payments": "Government payments such as pensions and JobSeeker that redistribute income to those with little or no market income.",
    "social wage": "Government-provided services (health, education, housing, transport) that lift the living standards of low-income earners beyond their cash income.",
    "poverty trap": "A situation where withdrawal of welfare plus tax on new earnings creates very high effective marginal tax rates, weakening the incentive to work.",
    "incentive effect": "The argument that income differences motivate effort, skill-building and entrepreneurial risk-taking.",
    "bracket creep": "Paying a higher average rate of tax over time as income growth pushes earners into higher tax brackets.",
    "flow concept": "A quantity measured over a period of time (e.g. income per week).",
    "stock concept": "A quantity measured at a point in time (e.g. wealth today)."
  },
  areas: [
    {
      id: "measuring",
      name: "Measuring inequality",
      blurb: "Lorenz curves, the Gini coefficient and quintiles — the toolkit.",
      icon: "📐",
      cards: [
        { id:"m1", type:"mc", marks:1,
          prompt:"On a Lorenz curve diagram, greater income inequality is shown by:",
          choices:[
            {t:"The curve moving closer to the diagonal line", ok:false, why:"Moving toward the diagonal (line of perfect equality) shows LESS inequality."},
            {t:"The curve bowing further away from the diagonal line", ok:true, why:"The larger the gap between the curve and the line of perfect equality, the greater the inequality."},
            {t:"The curve crossing the diagonal line", ok:false, why:"A Lorenz curve cannot cross the line of perfect equality — cumulative shares can't exceed equality."},
            {t:"A steeper diagonal line", ok:false, why:"The diagonal is fixed at 45° — it's the reference line, it doesn't move."}
          ]},
        { id:"m2", type:"calc", marks:2,
          prompt:"On a Lorenz diagram, the area between the line of perfect equality and the Lorenz curve is 0.2, and the remaining area under the curve is 0.3. Calculate the Gini coefficient (1 decimal place).",
          expected:0.4, tolerance:0.01,
          working:"Gini = A ÷ (A + B) = 0.2 ÷ (0.2 + 0.3) = 0.4",
          model:"0.4"},
        { id:"m3", type:"define", marks:2,
          prompt:"Define the Gini coefficient and state its possible range of values.",
          vocab:["lorenz","equality","zero","one"],
          model:"The Gini coefficient is a single-number measure of inequality, calculated from the Lorenz curve as the ratio of the area between the curve and the line of perfect equality to the total area under that line. It ranges from 0 (perfect equality) to 1 (perfect inequality)."},
        { id:"m4", type:"mc", marks:1,
          prompt:"A country's Gini coefficient for income falls from 0.34 to 0.31. This indicates:",
          choices:[
            {t:"Income inequality has increased", ok:false, why:"A rising Gini means rising inequality — this one fell."},
            {t:"Income inequality has decreased", ok:true, why:"A fall toward zero means the distribution has become more equal."},
            {t:"Average income has fallen", ok:false, why:"The Gini measures the spread of income, not its level."},
            {t:"Wealth is now more equal than income", ok:false, why:"This Gini describes income only — it says nothing about wealth."}
          ]},
        { id:"m5", type:"short", marks:3,
          prompt:"Explain why the ABS uses equivalised disposable household income, rather than gross income, when measuring inequality.",
          vocab:["tax","household","needs","compare"],
          model:"Gross income ignores two things that change real living standards: taxation and household composition. Disposable income (gross income less tax) shows what households can actually spend, and equivalising adjusts for the number of adults and children so a single person and a family of five can be compared on the same basis. Without these adjustments, measured inequality would mix up genuine income differences with differences in household size and tax paid."},
        { id:"m6", type:"calc", marks:2,
          prompt:"In 2019–20 the highest income quintile received 39.8% of equivalised disposable income and the lowest quintile 7.4%. Calculate how many times larger the top quintile's share was (1 decimal place).",
          expected:5.4, tolerance:0.1,
          working:"39.8 ÷ 7.4 ≈ 5.4 times",
          model:"About 5.4 times larger"}
      ]
    },
    {
      id: "income",
      name: "Income — sources & concepts",
      blurb: "Flow vs stock, earned vs unearned, and where household income comes from.",
      icon: "💵",
      cards: [
        { id:"i1", type:"define", marks:2,
          prompt:"Distinguish between income as a flow concept and wealth as a stock concept.",
          vocab:["flow","stock","period","point"],
          model:"Income is a flow: it is received over a period of time (e.g. wages per week) and can change with each period. Wealth is a stock: it is the value of net assets held at a single point in time. A flow adds to or drains a stock — saving income builds wealth."},
        { id:"i2", type:"mc", marks:1,
          prompt:"Which of the following is an example of unearned income?",
          choices:[
            {t:"A salary from full-time work", ok:false, why:"Wages and salaries are earned income — payment for labour."},
            {t:"Overtime payments", ok:false, why:"Overtime is still a return to labour, so it's earned income."},
            {t:"Dividends from owning shares", ok:true, why:"Dividends are a return on capital ownership, not labour — unearned income."},
            {t:"A performance bonus", ok:false, why:"Bonuses are tied to work performed, so they're earned income."}
          ]},
        { id:"i3", type:"mc", marks:1,
          prompt:"In 2024–25, the largest source of gross household income in Australia was:",
          choices:[
            {t:"Profits of unincorporated businesses", ok:false, why:"Profits were the second-largest source at about 17.7%."},
            {t:"Wages and salaries", ok:true, why:"Compensation of employees was about 57.9% of gross household income — by far the largest share."},
            {t:"Rent, interest and dividends", ok:false, why:"Property income contributed about 12.7%."},
            {t:"Social benefits", ok:false, why:"Welfare transfers were about 7.7% of the total."}
          ]},
        { id:"i4", type:"short", marks:3,
          prompt:"Explain how government transfer payments differ from market income, and give two examples of transfer payments.",
          vocab:["government","welfare","pension","market"],
          model:"Market income is earned through participating in production — wages for labour, profit for enterprise, rent and interest for property. Transfer payments are received from the government without any corresponding contribution to current production; they redistribute tax revenue to those with little market income. Examples include the age pension and JobSeeker payments (also acceptable: youth allowance, family benefits, disability support)."},
        { id:"i5", type:"calc", marks:3,
          prompt:"Using the 2024–25 resident tax rates (0% to $18,200; 16% from $18,201–$45,000; 30% from $45,001–$135,000), calculate the income tax payable on a taxable income of $60,000.",
          expected:8788, tolerance:1,
          working:"($45,000 − $18,200) × 16% = $4,288. ($60,000 − $45,000) × 30% = $4,500. Total = $8,788.",
          model:"$8,788"},
        { id:"i6", type:"mc", marks:1,
          prompt:"The 'social wage' refers to:",
          choices:[
            {t:"The national minimum wage set by the Fair Work Commission", ok:false, why:"That's a wage floor in the labour market — related, but not the social wage."},
            {t:"Government spending on services like health, education and housing that benefits low-income households", ok:true, why:"The social wage is the in-kind benefit of public services, lifting living standards beyond cash income."},
            {t:"Average weekly earnings across the economy", ok:false, why:"AWE is a measure of market wages, not government provision."},
            {t:"Superannuation paid by employers", ok:false, why:"Super is deferred employment income, not government service provision."}
          ]}
      ]
    },
    {
      id: "wealth",
      name: "Wealth — sources & the income link",
      blurb: "Net worth, what households own, and why wealth and income feed each other.",
      icon: "🏠",
      cards: [
        { id:"w1", type:"calc", marks:2,
          prompt:"A household owns assets valued at $950,000 and owes $180,000 in mortgage and personal loans. Calculate its net worth in dollars.",
          expected:770000, tolerance:0,
          working:"Net worth = total assets − total liabilities = $950,000 − $180,000 = $770,000",
          model:"$770,000"},
        { id:"w2", type:"mc", marks:1,
          prompt:"According to the ABS 2019–20 survey, the largest component of Australian household wealth was:",
          choices:[
            {t:"Superannuation balances", ok:false, why:"Super was the second-largest component at about 18.6%."},
            {t:"Owner-occupied housing and other property", ok:true, why:"Property made up about 56.2% of household assets — easily the largest share."},
            {t:"Shares, trusts and bonds", ok:false, why:"Financial securities were only about 5.1% of assets."},
            {t:"Bank deposits", ok:false, why:"Accounts with financial institutions were about 6.6%."}
          ]},
        { id:"w3", type:"short", marks:4,
          prompt:"Explain the relationship between the distribution of income and the distribution of wealth.",
          vocab:["wealth","income","saving","unearned"],
          model:"The two reinforce each other. High income earners can save more, and those savings accumulate into wealth — property, shares and superannuation. That wealth then generates unearned income (rent, interest, dividends), which raises their income further. Low income earners save little, accumulate little wealth, and so receive little unearned income. The result is that wealth inequality both reflects and amplifies income inequality over time."},
        { id:"w4", type:"mc", marks:1,
          prompt:"Wealth in Australia is distributed more unequally than income mainly because:",
          choices:[
            {t:"Wages differ widely between occupations", ok:false, why:"Wage differences drive income inequality — the question asks why wealth is even more unequal."},
            {t:"Wealth accumulates over a lifetime and compounds through home ownership and returns on assets", ok:true, why:"Wealth builds cumulatively — those with assets earn returns that buy more assets, and older households have had decades to accumulate."},
            {t:"The government taxes wealth more heavily than income", ok:false, why:"Australia has no general wealth tax, death duties or inheritance tax — wealth is taxed lightly."},
            {t:"Welfare payments are included in wealth statistics", ok:false, why:"Transfers are income, not wealth."}
          ]},
        { id:"w5", type:"define", marks:2,
          prompt:"Define net worth and identify the two broad categories of assets it includes.",
          vocab:["assets","liabilities","financial"],
          model:"Net worth is the value of total assets minus total liabilities at a point in time. Assets fall into two broad categories: non-financial (real) assets such as property and household contents, and financial assets such as bank deposits, shares and superannuation."}
      ]
    },
    {
      id: "patterns",
      name: "Patterns & people",
      blurb: "Quintile trends, mean vs median, and how age, gender and family shape income.",
      icon: "📊",
      cards: [
        { id:"p1", type:"mc", marks:1,
          prompt:"In 2019–20, mean equivalised disposable household income ($1,124/week) was higher than the median ($959/week). This tells us the distribution is:",
          choices:[
            {t:"Perfectly symmetrical", ok:false, why:"In a symmetrical distribution the mean and median are equal."},
            {t:"Skewed by a small number of very high incomes pulling the mean up", ok:true, why:"A long upper tail of high incomes raises the mean above the median — the classic asymmetric income distribution."},
            {t:"Skewed by a large number of very high incomes", ok:false, why:"It's a relatively small number of very high incomes that stretches the tail."},
            {t:"Becoming more equal over time", ok:false, why:"Comparing mean and median at one date says nothing about the trend."}
          ]},
        { id:"p2", type:"short", marks:4,
          prompt:"Explain how the income life cycle helps account for differences in income and wealth between younger and older households.",
          vocab:["life cycle","accumulate","retirement","working"],
          model:"Income and wealth follow a life-cycle pattern. Young households early in their working lives typically have moderate incomes and very little accumulated wealth. Through the working years, income peaks (roughly ages 35–54) and saving builds wealth in housing and superannuation. In retirement, income falls but accumulated wealth is high and is gradually drawn down. This explains why many older households combine low income with high net worth, while younger 'twin income' households can show the reverse."},
        { id:"p3", type:"mc", marks:1,
          prompt:"Which household type was most heavily concentrated in the lowest income quintile in 2019–20?",
          choices:[
            {t:"Couples with dependent children", ok:false, why:"Couple households, often with two earners, cluster in the middle and upper quintiles."},
            {t:"Couples without dependent children", ok:false, why:"This group had the largest share in the highest quintile."},
            {t:"Lone-person households", ok:true, why:"Around 41% of lone-person households sat in the lowest quintile — single earners (young or elderly) dominate the bottom."},
            {t:"Households with two income earners", ok:false, why:"Dual-earner households are the classic top-quintile profile."}
          ]},
        { id:"p4", type:"short", marks:3,
          prompt:"Outline TWO dimensions other than family structure along which the distribution of income varies in Australia.",
          vocab:["gender","age","occupation"],
          model:"Any two of: Gender — male average weekly earnings exceed female earnings, including within the same occupational categories. Age — earnings peak in the 35–54 age group and are lower for younger workers. Occupation — managers and professionals earn far more than sales and clerical workers. Ethnicity/indigeneity — earnings vary with country of birth and period of residence, and Indigenous Australians are among the lowest income earners."},
        { id:"p5", type:"mc", marks:1,
          prompt:"Between 2013–14 and 2019–20 the income Gini coefficient fell from 0.333 to 0.324. A plausible explanation consistent with the data is:",
          choices:[
            {t:"The abolition of progressive taxation", ok:false, why:"Removing progressivity would increase inequality, not reduce it."},
            {t:"Better targeting of social security support to low income earners", ok:true, why:"Stronger, better-targeted transfers lift the lowest quintiles' share, pulling the Gini down."},
            {t:"Faster growth in dividends and rent for high income households", ok:false, why:"Growth in unearned income at the top is associated with the periods where the Gini rose."},
            {t:"A rise in the share of income going to the top quintile", ok:false, why:"The top quintile's share actually fell about 1 percentage point over the period."}
          ]}
      ]
    },
    {
      id: "debate",
      name: "The inequality debate",
      blurb: "Benefits, costs, incentives and poverty traps — both sides of the argument.",
      icon: "⚖️",
      cards: [
        { id:"d1", type:"mc", marks:1,
          prompt:"The 'incentive effect' argument holds that some income inequality is beneficial because it:",
          choices:[
            {t:"Reduces the government's welfare bill automatically", ok:false, why:"Inequality tends to raise, not reduce, welfare spending."},
            {t:"Encourages effort, skill acquisition and entrepreneurial risk-taking", ok:true, why:"The prospect of higher rewards motivates productivity, training and investment — the core efficiency case for inequality."},
            {t:"Guarantees equal opportunity for all workers", ok:false, why:"Inequality of outcome says nothing about equality of opportunity."},
            {t:"Increases consumption by low income earners", ok:false, why:"Inequality lowers consumption among low income earners — that's a cost, not a benefit."}
          ]},
        { id:"d2", type:"short", marks:4,
          prompt:"Explain how a poverty trap can arise from the interaction of the welfare and taxation systems.",
          vocab:["effective marginal","withdraw","incentive","welfare"],
          model:"When a welfare recipient takes on paid work, two things happen at once: income support is withdrawn as earnings rise, and the new earnings are taxed. The combined effect is a very high effective marginal tax rate — in some ranges most of each extra dollar earned is lost. This weakens the financial incentive to seek or increase work, so welfare dependency can persist and even become intergenerational. That self-reinforcing situation is a poverty trap."},
        { id:"d3", type:"mc", marks:1,
          prompt:"A Keynesian economic cost of high income inequality is that it:",
          choices:[
            {t:"Raises aggregate demand through higher saving", ok:false, why:"Higher saving by the rich reduces consumption — it doesn't raise demand."},
            {t:"Lowers total consumption because low income earners spend a higher share of each dollar", ok:true, why:"Redistribution toward lower earners raises aggregate spending; concentration at the top dampens it — Keynes's deficient-demand argument."},
            {t:"Eliminates the need for government redistribution", ok:false, why:"The argument supports redistribution, not its removal."},
            {t:"Reduces the tax burden on middle income earners", ok:false, why:"Higher inequality tends to increase welfare costs and the tax burden."}
          ]},
        { id:"d4", type:"short", marks:3,
          prompt:"Outline ONE economic benefit and ONE social cost of inequality in the distribution of income.",
          vocab:["incentive","saving","social","poverty"],
          model:"Economic benefit (one of): the incentive effect on effort, skills and entrepreneurship; or higher national saving and investment from high earners, supporting capital accumulation and growth. Social cost (one of): social divisions and the alienation of marginalised groups; or relative poverty among low income groups such as single parents, the unemployed and Indigenous Australians."},
        { id:"e-debate", type:"essay", marks:20,
          prompt:"Analyse the economic and social benefits and costs of inequality in the distribution of income in Australia.",
          vocab:["incentive effect","aggregate demand","saving","poverty","social divisions","quintile","Gini"],
          scaffold:[
            "Define income inequality and reference a measure (Gini ≈ 0.32 for income).",
            "Economic benefits: incentive effect, saving & investment, labour mobility.",
            "Economic costs: lower consumption (Keynes), higher welfare spending and fiscal cost.",
            "Social benefits and costs: living standards at the top vs relative poverty, divisions, poverty traps.",
            "Judgement: weigh efficiency against equity with recent Australian evidence."],
          model:"A top-band response defines inequality and cites a measure, develops the incentive and saving/investment benefits, weighs them against deficient consumption, fiscal costs, relative poverty and social division, uses Australian data (quintile shares, Gini values), and reaches a clear judgement about the efficiency–equity trade-off."}
      ]
    },
    {
      id: "policy",
      name: "Fixing the gap — policy",
      blurb: "The tax-transfer system, the social wage and the minimum wage safety net.",
      icon: "🏛️",
      cards: [
        { id:"f1", type:"define", marks:2,
          prompt:"Define progressive taxation and explain briefly how it redistributes income.",
          vocab:["rate","rises","redistribute"],
          model:"Progressive taxation means the rate of tax rises as income rises, so higher earners pay a larger proportion of their income in tax. The revenue funds transfer payments and services directed mainly to lower income earners, shifting income from the top of the distribution toward the bottom."},
        { id:"f2", type:"mc", marks:1,
          prompt:"Which of the following is NOT part of Australia's tax-transfer approach to reducing inequality?",
          choices:[
            {t:"Means-tested pensions and JobSeeker payments", ok:false, why:"Targeted, means-tested transfers are a core element."},
            {t:"Progressive marginal tax rates with a tax-free threshold", ok:false, why:"The progressive income tax schedule is the revenue side of the system."},
            {t:"An inheritance tax on large estates", ok:true, why:"Australia has no death duties, inheritance tax or general wealth tax — a noted gap in taxing wealth."},
            {t:"Spending on the social wage (health, education, housing)", ok:false, why:"Social wage spending is the in-kind arm of redistribution."}
          ]},
        { id:"f3", type:"mc", marks:1,
          prompt:"From 1 July 2024, the marginal tax rate on income between $18,201 and $45,000 was:",
          choices:[
            {t:"19%", ok:false, why:"19% was the rate before the 2024 changes."},
            {t:"16%", ok:true, why:"The Stage Three changes cut this bracket's rate from 19% to 16%."},
            {t:"30%", ok:false, why:"30% applies to the $45,001–$135,000 bracket."},
            {t:"Nil", ok:false, why:"Only income up to the $18,200 tax-free threshold is untaxed."}
          ]},
        { id:"f4", type:"short", marks:4,
          prompt:"Explain how raising tax thresholds addresses 'bracket creep' and which income groups benefit most.",
          vocab:["bracket creep","threshold","real","burden"],
          model:"Bracket creep occurs because tax thresholds are fixed in dollar terms: as nominal incomes grow, earners drift into higher brackets and pay a rising average tax rate without being better off in real terms. Raising thresholds (as in the 2020 and 2024 budgets) restores the real value of the brackets, cutting the average rate back. The largest relative benefit goes to low and middle income earners around the adjusted thresholds, reducing their tax burden compared with high income earners."},
        { id:"f5", type:"short", marks:3,
          prompt:"Outline the role of the National Minimum Wage and Modern Awards in reducing income inequality.",
          vocab:["minimum wage","safety net","bargaining","fair work"],
          model:"The National Minimum Wage and Modern Awards form a wage safety net for workers with low skills and weak bargaining power. Annual adjustments by the Fair Work Commission (e.g. the 3.5% rise to $948/week from July 2025) protect the real incomes of the low paid, compressing the bottom of the wage distribution and supporting minimum living standards alongside the welfare system."},
        { id:"e-policy", type:"essay", marks:20,
          prompt:"Assess the effectiveness of the Australian Government's tax-transfer system in reducing inequality in the distribution of income and wealth.",
          vocab:["progressive taxation","transfer payments","means tested","social wage","poverty trap","Gini","bracket creep"],
          scaffold:[
            "Define the tax-transfer system: progressive taxation + targeted, means-tested transfers + the social wage.",
            "Evidence it works: equivalised disposable income is far more equal than market income; Gini for disposable income (~0.32) vs gross (~0.44).",
            "Mechanisms: tax-free threshold and rate cuts, pensions/JobSeeker, ~37% of revenue to welfare, social wage services.",
            "Limits: wealth is barely taxed (no inheritance tax; wealth Gini ~0.61), poverty traps from high EMTRs, bracket creep between reforms.",
            "Judgement: effective for income, much weaker for wealth."],
          model:"A top-band response defines the tax-transfer system, demonstrates with data that disposable income is distributed far more equally than market income, develops the tax and transfer mechanisms including the social wage, then weighs the limits — minimal taxation of wealth, poverty traps from high effective marginal tax rates, bracket creep — and concludes the system is effective at compressing income inequality but leaves wealth inequality largely untouched."}
        ,
        { id:"e-wealthgap", type:"essay", marks:12,
          prompt:"Explain why the distribution of wealth in Australia is more unequal than the distribution of income.",
          vocab:["net worth","accumulate","life cycle","unearned income","home ownership","Gini"],
          scaffold:[
            "Contrast the two with data: wealth Gini ≈ 0.61 vs income Gini ≈ 0.32; top quintile holds ~63% of net worth but ~40–48% of income.",
            "Wealth compounds: assets generate returns that buy more assets.",
            "Life cycle: wealth accumulates over decades, concentrating in older households.",
            "Home ownership and inheritance concentrate wealth; income is partly equalised by the tax-transfer system while wealth is barely taxed.",
            "Conclude by linking the income–wealth feedback loop."],
          model:"A strong response quantifies the gap (wealth Gini around 0.61 versus about 0.32 for disposable income), then explains the mechanisms: wealth compounds through returns on assets, accumulates over the life cycle, and is concentrated by home ownership and inheritance, while the tax-transfer system equalises income each year but leaves wealth holdings largely untaxed."}
      ]
    }
  ]
};

// -----------------------------------------------------------------------------
// Concept context ("why" explanations) and hints, merged onto cards by id.
// Context = the underlying information that answers the question, available
// on request after answering (or on reveal in flashcard mode).
// -----------------------------------------------------------------------------
(function () {
  const ctx = {
    m1: "The Lorenz curve plots the cumulative share of the population (poorest first) against the cumulative share of income they receive. Perfect equality is the 45° diagonal — every 20% of people gets 20% of income. The more the curve sags below that line, the bigger the share held by the top, so the bow IS the inequality.",
    m2: "The Gini coefficient turns the Lorenz picture into one number: the gap area between the curve and the diagonal (A), divided by the whole triangle under the diagonal (A + B). No gap → 0 (perfect equality); the gap is everything → 1 (one person has it all).",
    m3: "Because it compresses a whole distribution into one value between 0 and 1, the Gini lets you compare inequality across countries and across time. Australia's income Gini has hovered around 0.32 in recent ABS surveys; its wealth Gini is near 0.61.",
    m4: "Movements in the Gini are read directionally: toward 1 = more unequal, toward 0 = more equal. It says nothing about whether people are richer or poorer overall — a country can get richer and more unequal at once.",
    m5: "The ABS adjusts twice before comparing households. Subtracting tax gives disposable income (what's actually spendable), and equivalising rescales for household size and composition — $2,000 a week means something different for a single person than for a family of five. Only then are like compared with like.",
    m6: "Quintile shares are the simplest inequality read-out: rank everyone, cut into five equal 20% groups, and compare income shares. In 2019–20 the top fifth received about 39.8% of equivalised disposable income, the bottom fifth about 7.4% — a ratio of roughly five to one.",
    i1: "Income is measured over a period (per week, per year) — a flow, like water through a tap. Wealth is measured at an instant — a stock, like the level in the tub. The two connect through saving: unspent income flows into the stock of wealth.",
    i2: "Earned income is a return to labour: wages, salaries, overtime, bonuses. Unearned income is a return to owning things: rent from land, interest on capital, dividends and profit from enterprise. The distinction matters because unearned income flows mostly to those who already hold wealth.",
    i3: "ABS national accounts for 2024–25 put wages and salaries at about 57.9% of gross household income, profits of unincorporated businesses about 17.7%, property income (rent, interest, dividends) about 12.7%, and social benefits about 7.7%. Labour income dominates — which is why wage trends drive inequality trends.",
    i4: "Market income is earned by contributing factors of production. Transfer payments redistribute tax revenue to those with little market income — pensions, JobSeeker, family benefits — without a corresponding contribution to current production. They're the 'transfer' half of the tax-transfer system.",
    i5: "Australia's income tax is progressive through brackets: each extra dollar is taxed at the rate of the bracket it falls into. You never pay a bracket's rate on your whole income — only on the slice inside it. That's why the calculation works slice by slice.",
    i6: "The social wage is redistribution in kind rather than cash: public health (Medicare), education, housing, transport and childcare. A low-income family's real living standard includes these services, so the social wage narrows inequality in ways cash income measures miss.",
    w1: "Net worth is the balance-sheet view of a household: everything owned (property, super, deposits, shares, contents, vehicles) minus everything owed (mortgages, personal loans). It's the standard measure of wealth precisely because gross assets alone ignore the debt behind them.",
    w2: "In the 2019–20 ABS survey, property — owner-occupied homes plus investment property — made up about 56% of household assets, with superannuation next at about 19%. That property dominance is why house prices are the single biggest driver of Australian wealth inequality.",
    w3: "Income and wealth feed each other in a loop: high income → high saving → assets → unearned income (rent, interest, dividends) → even higher income. Low earners can't start the loop. This feedback is why wealth gaps outgrow income gaps over time.",
    w4: "Wealth compounds and accumulates over decades; income is largely re-earned each year and is equalised annually by tax and transfers. Add home ownership, inheritance, and the absence of any general wealth or inheritance tax in Australia, and the wealth Gini (≈0.61) sits far above the income Gini (≈0.32).",
    w5: "Assets split into non-financial (real) — property, household contents, vehicles — and financial — deposits, shares, trusts, bonds and superannuation. Net worth = both categories of assets minus total liabilities, valued at a point in time.",
    p1: "When a distribution has a long upper tail, the mean is dragged above the median: a handful of very high incomes lifts the average, while the 'typical' household (the median) sits lower. Mean $1,124 vs median $959 per week in 2019–20 is the signature of that right skew.",
    p2: "Income follows a hump over the life cycle — low in early adulthood, peaking around ages 35–54, falling in retirement — while wealth climbs steadily through the working years and is drawn down later. That's why 'low income, high wealth' retirees and 'decent income, no wealth' young households both exist.",
    p3: "Lone-person households have one income at most, and many are young workers or retirees — about 41% sat in the lowest quintile in 2019–20. Couples, especially dual earners, dominate the top quintiles. Household structure is one of the strongest predictors of where you sit in the distribution.",
    p4: "The distribution differs systematically by gender (male AWE about $2,074 vs female $1,814 in 2024), age (peak earnings at 35–54), occupation (managers and professionals vs sales and clerical), and ethnicity and indigeneity. These dimensions overlap — which is why inequality persists across generations.",
    p5: "The income Gini eased from 0.333 (2013–14) to 0.324 (2019–20). Better-targeted social security lifts the bottom quintiles' share, compressing the distribution; periods where unearned income at the top grew fast (2015–16 to 2017–18) pushed the Gini back up.",
    d1: "The efficiency case for some inequality: differential rewards motivate skill acquisition, effort and entrepreneurial risk-taking, and let wages signal where labour is most valued. Flatten rewards entirely and you blunt those incentives — the heart of the equity–efficiency trade-off.",
    d2: "As a welfare recipient earns more, benefits are withdrawn AND tax kicks in. The two together create high effective marginal tax rates (EMTRs) — in some ranges most of each extra dollar is lost — so working more barely pays. That disincentive is the poverty trap, and it can entrench welfare dependency.",
    d3: "Keynes's point: lower-income households spend a larger fraction of each dollar (higher marginal propensity to consume). Concentrating income at the top, where more is saved, drains consumption and aggregate demand — so high inequality can itself weaken growth.",
    d4: "The debate balances efficiency gains (incentives, saving, investment) against equity costs (lower consumption at the bottom, bigger welfare bills, social division, relative poverty). Strong essays argue both sides and land a judgement rather than listing points.",
    "e-debate": "Frame the essay around the efficiency–equity trade-off: incentives and saving on one side; deficient demand, fiscal cost, poverty and social division on the other. Anchor claims in Australian data — quintile shares, Gini ≈ 0.32 income / 0.61 wealth — and finish with a clear judgement.",
    f1: "Progressive taxation means the average rate rises with income — the top marginal rate (45%) applies only above $190,000, while the first $18,200 is tax-free. The revenue funds transfers and services directed down the distribution: that's redistribution in one system.",
    f2: "Australia taxes income progressively but barely taxes wealth: no inheritance tax, no death duties, no general wealth tax. Capital gains tax and fringe benefits tax touch wealth indirectly, which is part of why wealth inequality stays roughly double income inequality.",
    f3: "The 2024 changes cut the 19% rate to 16% and the 32.5% rate to 30%, and lifted two thresholds. Rate cuts at the bottom brackets deliver the largest proportional benefit to low and middle earners — the equity rationale for their design.",
    f4: "Thresholds are set in dollars, so wage growth quietly pushes earners into higher brackets — bracket creep — raising average tax rates without any real income gain. Periodic threshold rises (2020, 2024) hand back that creep; between reforms, it accumulates again.",
    f5: "The minimum wage and award system is a wage floor under the whole distribution: the Fair Work Commission's annual review (e.g. +3.5% to $948/week from July 2025) protects the real income of workers with the least bargaining power, compressing the bottom of the wage spread.",
    "e-policy": "Structure the assessment around mechanism → evidence → limits. The system demonstrably compresses income (disposable Gini ≈ 0.32 vs ≈ 0.44 gross) via progressive tax, means-tested transfers and the social wage — but wealth is barely taxed, EMTRs create poverty traps, and bracket creep erodes gains between reforms.",
    "e-wealthgap": "The answer hinges on three mechanisms: wealth compounds (returns buy more assets), wealth accumulates over the life cycle, and the tax-transfer system equalises income annually while leaving wealth holdings essentially untaxed. Quantify with the two Ginis (≈0.61 vs ≈0.32)."
  };
  const hints = {
    m1: "Where does the bottom 20% of families end up on each axis if income is very unequal?",
    m4: "Which direction is 'perfect equality' — toward 0 or toward 1?",
    i2: "Earned = paid for your labour. What are you being paid for in each option?",
    i3: "Think about where most Australian households get the bulk of their money each week.",
    i6: "It's about what governments provide, not what employers pay.",
    w2: "What do most Australian households 'own' that's worth the most?",
    w4: "Income restarts every year — what does wealth do over a lifetime?",
    p1: "Which way does a small number of very large values drag an average?",
    p3: "How many earners can a lone-person household have?",
    p5: "Which policy lever lifts the bottom quintile's share without touching the top?",
    d1: "Why would anyone train for years or risk savings on a business?",
    d3: "Who spends more of each extra dollar — a low or high income household?",
    f2: "Think about which taxes Australia famously does NOT have.",
    f3: "The 2024 cuts lowered the old 19% rate — to what?"
  };
  window.CONTENT.areas.forEach(a => a.cards.forEach(c => {
    if (ctx[c.id]) c.context = ctx[c.id];
    if (hints[c.id]) c.hint = hints[c.id];
  }));
})();

// -----------------------------------------------------------------------------
// Stimulus-based cards (exam Section III style): source material + question.
// -----------------------------------------------------------------------------
(function () {
  const patterns = window.CONTENT.areas.find(a => a.id === "patterns");
  patterns.cards.push({
    id: "p6", type: "short", marks: 4,
    stimulus: "Shares of household net worth and gross weekly income by quintile, Australia 2019–20 (ABS):\n\nQuintile        Net worth   Gross income\nLowest 20%        0.7%          4.1%\nSecond            4.8%          9.3%\nThird            11.3%         15.4%\nFourth           20.5%         23.6%\nHighest 20%      62.8%         47.6%",
    prompt: "Using the data provided, contrast the distribution of wealth with the distribution of income in Australia.",
    vocab: ["quintile", "net worth", "unequal"],
    model: "The data shows wealth is distributed far more unequally than income. The highest quintile held 62.8% of net worth but received a smaller (though still large) 47.6% share of gross income, while the lowest quintile held just 0.7% of net worth against 4.1% of income — a wealth gap of roughly 90:1 between top and bottom versus about 12:1 for income. Every quintile below the top holds a smaller share of wealth than of income, confirming wealth concentrates at the top more than income does.",
    context: "Stimulus questions are marked on whether you USE the data — quote the relevant figures and compare them directly. The wealth distribution is roughly twice as unequal as income (Gini ≈ 0.61 vs ≈ 0.32) because wealth compounds over lifetimes while income is partly equalised each year by tax and transfers.",
    hint: "Pick the top and bottom quintiles and compare their two shares directly — numbers, not vibes."
  });
  const measuring = window.CONTENT.areas.find(a => a.id === "measuring");
  measuring.cards.push({
    id: "m7", type: "calc", marks: 2,
    stimulus: "Equivalised disposable household income shares, 2019–20 (ABS):\nLowest quintile: 7.4% · Second: 12.6% · Third: 17.2% · Fourth: 23.0% · Highest: 39.8%",
    prompt: "Using the data, calculate the combined share of income received by the middle three quintiles (a single percentage, 1 decimal place).",
    expected: 52.8, tolerance: 0.1,
    working: "12.6 + 17.2 + 23.0 = 52.8%",
    model: "52.8%",
    context: "The middle 60% receiving 52.8% — slightly less than a proportionate share — is the statistical signature of Australia's 'middle-class society': most inequality comes from the gap between the top and bottom quintiles, not the middle.",
    hint: "Which three quintiles are 'the middle'? Add just those."
  });
})();

// -----------------------------------------------------------------------------
// LESSONS — small discrete learning chunks per area, each ending with a quick
// check (one interactive element per unit). Original teaching text.
// -----------------------------------------------------------------------------
(function () {
  const L = {
    measuring: [{ id: "les-measuring", title: "How economists measure inequality", chunks: [
      { h: "Ranking the population", body: "To measure inequality you first need a fair way to line everyone up. The ABS ranks households by income and cuts the population into quintiles — five equal 20% groups. If income were shared perfectly evenly, each quintile would receive exactly 20% of the total. In reality the bottom quintile receives about 7.4% and the top about 39.8%, and the gap between those numbers is the inequality we want to capture.",
        check: { q: "If income were perfectly equal, what share would each quintile receive?", opts: [
          { t: "20%", ok: true, why: "Five equal groups sharing equally means 20% each — that's the benchmark all real data is compared against." },
          { t: "7.4%", ok: false, why: "7.4% is the bottom quintile's actual share — evidence of inequality, not equality." },
          { t: "It depends on average income", ok: false, why: "Equality is about shares, not levels — equal shares are 20% regardless of how rich the country is." }]}},
      { h: "Drawing the picture: the Lorenz curve", body: "The Lorenz curve turns those shares into a picture. Plot the cumulative share of the population on one axis and the cumulative share of income they receive on the other. Perfect equality traces the 45° diagonal — the first 20% of people hold 20% of income, the first 60% hold 60%, and so on. Real economies sag below that line, and the deeper the sag, the more income is concentrated at the top.",
        check: { q: "On a Lorenz diagram, what does a deeper sag below the diagonal mean?", opts: [
          { t: "More inequality", ok: true, why: "The gap between the curve and the line of perfect equality IS the inequality — bigger gap, bigger concentration at the top." },
          { t: "Higher average income", ok: false, why: "The Lorenz curve shows distribution, not the level of income." },
          { t: "A larger population", ok: false, why: "Both axes are percentages, so population size doesn't change the shape." }]}},
      { h: "One number: the Gini coefficient", body: "The Gini coefficient compresses the whole picture into a single value: the area between the diagonal and the Lorenz curve, divided by the entire triangle under the diagonal. Zero means perfect equality; one means a single person has everything. Australia's income Gini sits around 0.32 — and the same tool applied to wealth gives roughly 0.61, nearly double. One measure, two very different stories.",
        check: { q: "A Gini coefficient moving from 0.33 toward 0.40 means:", opts: [
          { t: "Inequality is increasing", ok: true, why: "Movement toward 1 always means a less equal distribution." },
          { t: "Inequality is decreasing", ok: false, why: "Decreasing inequality moves the Gini toward 0, not away from it." },
          { t: "Incomes are falling", ok: false, why: "The Gini says nothing about income levels — only how they're spread." }]}}
    ]}],
    income: [{ id: "les-income", title: "Where income comes from", chunks: [
      { h: "Income is a flow", body: "Income is money received over a period — per week, per year. Economists call this a flow, like water running from a tap. Earned income is a return to labour: wages, salaries, overtime. Unearned income is a return to owning things: rent from land, interest on capital, dividends and profit from enterprise. The distinction matters because unearned income flows mostly to people who already hold wealth.",
        check: { q: "Which of these is unearned income?", opts: [
          { t: "Dividends from shares", ok: true, why: "Dividends reward ownership of capital, not hours worked — the definition of unearned income." },
          { t: "Overtime pay", ok: false, why: "Overtime is payment for labour — earned income." },
          { t: "A weekend shift loading", ok: false, why: "Penalty rates are still wages: a return to labour." }]}},
      { h: "What Australian households actually receive", body: "The national accounts break household income into sources. Wages and salaries dominate at about 58% of the total. Business profits contribute roughly 18%, property income — rent, interest and dividends — about 13%, and government social benefits about 8%. Because wages are the overwhelming source, what happens to wages largely decides what happens to the whole income distribution.",
        check: { q: "The largest source of household income in Australia is:", opts: [
          { t: "Wages and salaries", ok: true, why: "At nearly 58% of gross household income, labour income dwarfs every other source." },
          { t: "Government benefits", ok: false, why: "Social benefits are around 8% — vital for low-income households, but small in aggregate." },
          { t: "Rent, interest and dividends", ok: false, why: "Property income is about 13% — significant, but far behind wages." }]}},
      { h: "Transfers: income without production", body: "Not all income is paid for contributing to production. Transfer payments — the age pension, JobSeeker, family benefits — redistribute tax revenue to households with little or no market income. They are means-tested so support targets those most in need. Alongside cash transfers sits the social wage: public health, education, housing and transport, which raise low-income living standards without appearing in anyone's pay packet.",
        check: { q: "What makes a transfer payment different from market income?", opts: [
          { t: "It isn't payment for contributing to current production", ok: true, why: "Transfers redistribute existing tax revenue rather than rewarding labour, capital or enterprise." },
          { t: "It is always larger than a wage", ok: false, why: "Transfers provide a minimum income — typically far below average wages." },
          { t: "Only retirees can receive it", ok: false, why: "JobSeeker, family benefits and disability support all go to working-age households." }]}}
    ]}],
    wealth: [{ id: "les-wealth", title: "Wealth and the income-wealth loop", chunks: [
      { h: "Wealth is a stock", body: "Where income flows, wealth sits. Wealth — or net worth — is the value of everything a household owns minus everything it owes, measured at a point in time. Assets split into non-financial (the home, contents, vehicles) and financial (deposits, shares, superannuation). Subtract liabilities like the mortgage and you have net worth: the household balance sheet in one number.",
        check: { q: "A household has $900,000 in assets and $250,000 in debts. Its net worth is:", opts: [
          { t: "$650,000", ok: true, why: "Net worth = assets − liabilities = 900,000 − 250,000." },
          { t: "$900,000", ok: false, why: "That's gross assets — ignoring the debt behind them overstates wealth." },
          { t: "$1,150,000", ok: false, why: "Liabilities are subtracted, not added." }]}},
      { h: "What Australians own", body: "Property towers over everything: owner-occupied homes and investment property make up about 56% of household assets, with superannuation next at about 19%. This is why house prices are the single biggest force in Australian wealth inequality — when property booms, wealth concentrates among those who already own it, and the deposit gap grows for those who don't.",
        check: { q: "Why do house prices matter so much for wealth inequality in Australia?", opts: [
          { t: "Property is over half of all household wealth", ok: true, why: "When the dominant asset class rises, gains flow to existing owners — widening the gap with non-owners." },
          { t: "Houses are the only taxed asset", ok: false, why: "Owner-occupied homes are actually lightly taxed — no capital gains tax applies." },
          { t: "Most households own no property", ok: false, why: "Most do — that's precisely why it dominates the wealth statistics." }]}},
      { h: "The loop that widens the gap", body: "Income and wealth feed each other. High earners save more; savings become assets; assets generate unearned income — rent, interest, dividends — which lifts income further, buying still more assets. Low earners can't start the loop. Wealth also compounds over a lifetime and passes between generations, while income is partly equalised every single year by tax and transfers. The result: wealth inequality (Gini ≈ 0.61) runs about double income inequality (≈ 0.32).",
        check: { q: "Why is wealth distributed more unequally than income?", opts: [
          { t: "Wealth compounds and accumulates while income is equalised annually", ok: true, why: "Returns buy more assets, lifetimes of accumulation stack up, and the tax-transfer system works on income, barely touching wealth." },
          { t: "Wages differ between occupations", ok: false, why: "That explains income inequality — the question is why wealth is even MORE unequal." },
          { t: "The ABS measures wealth less accurately", ok: false, why: "The gap is real and consistent across surveys, not a measurement artefact." }]}}
    ]}],
    patterns: [{ id: "les-patterns", title: "Reading the patterns", chunks: [
      { h: "Mean versus median", body: "In 2019–20 mean household income was $1,124 a week but the median was $959. Whenever the mean sits above the median, a small number of very high values is stretching the average upward — the classic right-skewed income distribution. The median tells you about the typical household; the mean is dragged around by the top of the distribution.",
        check: { q: "Mean income above median income tells you:", opts: [
          { t: "A small number of high incomes is pulling the average up", ok: true, why: "A long upper tail lifts the mean; the median stays anchored at the typical household." },
          { t: "Most households earn above average", ok: false, why: "It's the reverse — most households earn below a mean inflated by the top tail." },
          { t: "Inequality is falling", ok: false, why: "A single snapshot of mean vs median says nothing about the trend." }]}},
      { h: "Who sits where", body: "Income varies systematically across groups. Male average weekly earnings exceed female earnings, including within the same occupations. Earnings peak between ages 35 and 54. Managers and professionals out-earn sales and clerical workers severalfold. Lone-person households crowd the bottom quintile — about 41% of them — while dual-earner couples dominate the top. Knowing these dimensions is what turns a data table into an explanation.",
        check: { q: "Which household type is most concentrated in the lowest income quintile?", opts: [
          { t: "Lone-person households", ok: true, why: "One income at most, and many are young workers or retirees — about 41% sit in the bottom quintile." },
          { t: "Couples with two earners", ok: false, why: "Dual-earner couples are the classic top-quintile profile." },
          { t: "Couples with dependent children", ok: false, why: "They cluster across the middle and upper quintiles." }]}},
      { h: "The life cycle behind the numbers", body: "Much apparent inequality is really the life cycle in motion. Young households earn moderately and own little. Peak earning years build wealth through the mortgage and superannuation. Retirees show low income but high net worth, gradually drawn down. This is why 'low income' and 'poor' aren't synonyms — a retired couple in a paid-off home and a young renter on the same income are in very different positions.",
        check: { q: "Why can a household have low income but high wealth?", opts: [
          { t: "Wealth accumulated over a working life persists into retirement", ok: true, why: "Retirees typically combine decades of accumulated assets with reduced current income." },
          { t: "Low incomes always cause high wealth", ok: false, why: "If anything the correlation runs the other way — this is the life-cycle exception, not the rule." },
          { t: "Wealth statistics exclude retirees", ok: false, why: "Retirees are included — they're a major reason the pattern exists." }]}}
    ]}],
    debate: [{ id: "les-debate", title: "The case for and against inequality", chunks: [
      { h: "The efficiency case", body: "Some inequality, the argument runs, is the price of incentives. Differential rewards motivate people to train, work harder and take entrepreneurial risks; high earners save more, funding investment and capital accumulation. Flatten all rewards and you blunt the engine. This is the efficiency side of the equity–efficiency trade-off, and a strong essay can state it fairly even while disputing it.",
        check: { q: "The 'incentive effect' argument says inequality:", opts: [
          { t: "Motivates skill-building, effort and risk-taking", ok: true, why: "The prospect of higher rewards is claimed to drive productivity and enterprise." },
          { t: "Guarantees equal opportunity", ok: false, why: "Outcome inequality says nothing about opportunity — a common conflation to avoid." },
          { t: "Reduces the need for saving", ok: false, why: "The argument claims the opposite: high earners save more, funding investment." }]}},
      { h: "The costs: demand, budgets and division", body: "Against that: low-income households spend a larger fraction of each dollar, so concentrating income at the top drains consumption — Keynes's deficient-demand point. Inequality also raises welfare spending and strains the budget, and socially it can fracture: relative poverty, marginalised groups, and resentment between taxpayers and recipients. The costs are both macroeconomic and social.",
        check: { q: "Keynes's argument about inequality and demand was that:", opts: [
          { t: "Concentrating income where it's saved lowers total consumption", ok: true, why: "Low earners spend more of each dollar — shifting income upward weakens aggregate demand." },
          { t: "High inequality raises consumption", ok: false, why: "The reverse — the rich save a larger share of each extra dollar." },
          { t: "Demand has nothing to do with distribution", ok: false, why: "His point was precisely that distribution shapes demand." }]}},
      { h: "Poverty traps: where the systems collide", body: "The sharpest cost appears where welfare and tax interact. As a recipient earns more, benefits are withdrawn and tax kicks in simultaneously — effective marginal tax rates can climb so high that working extra barely pays. That disincentive is a poverty trap, and it can entrench dependency across generations. It's the strongest single piece of evidence that how redistribution is designed matters as much as how much.",
        check: { q: "A poverty trap is caused by:", opts: [
          { t: "Benefit withdrawal plus tax creating very high effective marginal rates", ok: true, why: "Losing most of each extra dollar earned destroys the incentive to work more." },
          { t: "Welfare payments being too small to live on", ok: false, why: "The trap is about the penalty for EARNING more, not the payment level itself." },
          { t: "Banks refusing loans to low earners", ok: false, why: "Credit access matters, but the trap is a tax-and-transfer interaction." }]}}
    ]}],
    policy: [{ id: "les-policy", title: "How government narrows the gap", chunks: [
      { h: "The tax side: progressive rates", body: "Australia taxes income progressively: nothing on the first $18,200, then rising marginal rates — 16%, 30%, 37% and 45% — on each successive slice. Higher earners therefore pay a higher average rate, and the revenue funds redistribution. Threshold rises (2020, 2024) also wind back bracket creep, where wage growth quietly pushes people into higher brackets with no real income gain.",
        check: { q: "Progressive taxation means:", opts: [
          { t: "The rate of tax rises as income rises", ok: true, why: "Higher slices of income face higher marginal rates, so the average rate climbs with income." },
          { t: "Everyone pays the same percentage", ok: false, why: "That's a proportional (flat) tax." },
          { t: "Only the wealthy pay any tax", ok: false, why: "Most earners pay tax — the RATE rises with income, the base stays broad." }]}},
      { h: "The transfer side: targeted support and the social wage", body: "Around 37% of budget spending — about $291 billion in 2025–26 — goes to social security: pensions, JobSeeker, family and disability support, all means-tested to reach those most in need. Around it sits the social wage (Medicare, public education, housing, transport) and the wage floor: the National Minimum Wage and awards, adjusted annually to protect the lowest-paid workers' real incomes.",
        check: { q: "Why are Australian welfare payments means-tested?", opts: [
          { t: "To target limited revenue at those most in need", ok: true, why: "Income and assets tests concentrate support where it lifts living standards most per dollar." },
          { t: "To make everyone eligible", ok: false, why: "Means-testing does the opposite of universal eligibility." },
          { t: "To replace the minimum wage", ok: false, why: "The wage floor and the transfer system operate side by side." }]}},
      { h: "How well does it work?", body: "Judged on income, well: the distribution of disposable income (Gini ≈ 0.32) is far more equal than market income (≈ 0.44) — the system visibly compresses the gap every year. Judged on wealth, barely: Australia has no inheritance tax, no death duties, no general wealth tax, and the wealth Gini sits near 0.61. The honest assessment for an essay: effective on income, largely untouched wealth — and poverty traps and bracket creep are the recurring design flaws.",
        check: { q: "The fairest one-line assessment of the tax-transfer system is:", opts: [
          { t: "Effective at compressing income inequality, weak on wealth", ok: true, why: "Disposable income is much more equal than market income, but wealth is barely taxed and stays twice as unequal." },
          { t: "It has eliminated inequality", ok: false, why: "It compresses inequality substantially — elimination isn't the design or the result." },
          { t: "It has no effect", ok: false, why: "The gap between the market and disposable income Ginis is direct evidence of its effect." }]}}
    ]}]
  };
  window.CONTENT.areas.forEach(a => { if (L[a.id]) a.lessons = L[a.id]; });

  // ---- topic layer: the main page selects an economics topic ----
  window.CONTENT.topics = [
    { id: "issues-distribution", name: "Distribution of Income & Wealth", icon: "⚖️",
      blurb: "Topic 3 · Economic Issues — fully loaded with lessons and practice",
      areas: window.CONTENT.areas },
    { id: "global", name: "The Global Economy", icon: "🌏",
      blurb: "Topic 1 — globalisation, trade and development", areas: [], locked: true },
    { id: "australia", name: "Australia's Place in the Global Economy", icon: "🦘",
      blurb: "Topic 2 — trade, exchange rates and the BOP", areas: [], locked: true },
    { id: "policies", name: "Economic Policies & Management", icon: "🏛️",
      blurb: "Topic 4 — fiscal, monetary and microeconomic policy", areas: [], locked: true }
  ];
})();

// -----------------------------------------------------------------------------
// Infographic assignments: chunk → chart key (charts defined in app.js INFO).
// All charts are original designs of public ABS / Budget data.
// -----------------------------------------------------------------------------
(function () {
  const map = {
    "les-measuring": { 0: "quintiles", 2: "lorenz" },
    "les-income":    { 1: "incomeSources" },
    "les-wealth":    { 1: "wealthMix", 2: "incomeVsWealth" },
    "les-policy":    { 0: "taxBrackets" }
  };
  window.CONTENT.areas.forEach(a => (a.lessons || []).forEach(l => {
    const m = map[l.id]; if (m) Object.entries(m).forEach(([i, v]) => { l.chunks[+i].viz = v; });
  }));
})();

// -----------------------------------------------------------------------------
// SOURCE REFERENCES per lesson chunk — precise pointers into the resource
// (Riley, Year 12 Economics 2026, Ch. 11) and the underlying public data,
// so lesson content can be verified side-by-side. References only; the
// chapter text itself is not reproduced.
// -----------------------------------------------------------------------------
(function () {
  const S = {
    "les-measuring": [
      { ref: "Ch. 11, p. 245 — 'Trends in the Distribution of Income and Wealth' & Table 11.3",
        data: ["Quintile shares 7.4 / 12.6 / 17.2 / 23.0 / 39.8% (2019–20) — Table 11.3, sourced from ABS Cat. 6523.0, Household Income and Wealth 2019–20",
               "Quintile method (equal 20% groupings, equivalised disposable income) — p. 245"] },
      { ref: "Ch. 11, p. 241 — 'The Measurement of the Distribution of Income' & Figure 11.1",
        data: ["Four properties of the Lorenz curve (starts at zero, ends at 100/100, 45° equality line, real curves lie below) — p. 241",
               "Inward shift = reduced inequality, outward = increased — p. 241"] },
      { ref: "Ch. 11, pp. 241–242 — Gini coefficient definition and worked extremes",
        data: ["Gini = Area A ÷ (Area A + Area B) — p. 241",
               "Range 0 (perfect equality) to 1 (perfect inequality), direction of movement — p. 242",
               "Income Gini 0.324 (2019–20) — Table 11.3, p. 245 · wealth Gini 0.611 — Table 11.4, p. 247"] }
    ],
    "les-income": [
      { ref: "Ch. 11, p. 242 — 'The Sources of Income'",
        data: ["Income as a flow concept; earned (wages/salaries) vs unearned (rent, interest, profit) — p. 242"] },
      { ref: "Ch. 11, p. 242 — Figure 11.2 & Table 11.1",
        data: ["Shares 2024–25: wages 57.9%, profits 17.7%, property 12.7%, social benefits 7.7%, other ~4% — ABS Cat. 5206.0, National Accounts, Table 20",
               "Total gross income $2,264,201m, +6.7% on 2023–24 — Table 11.1, p. 243"] },
      { ref: "Ch. 11, p. 243 — 'Taxation, Transfer Payments and Other Assistance'",
        data: ["Transfer payments: pensions, JobSeeker, family benefits; means-tested targeting — p. 243",
               "Social wage: health, education, transport, housing, childcare, community services (e.g. Medicare) — p. 243"] }
    ],
    "les-wealth": [
      { ref: "Ch. 11, p. 244 — 'The Sources of Wealth'",
        data: ["Wealth as a stock; net worth = non-financial + financial assets − liabilities — p. 244"] },
      { ref: "Ch. 11, p. 244 — Table 11.2",
        data: ["Asset shares 2019–20: property 56.2%, super 18.6%, deposits 6.6%, contents 6.1%, businesses 5.2%, shares/trusts 5.1%, vehicles 2.2% — ABS Cat. 6523.0",
               "Total assets $12,356b, liabilities $2,038b, net worth $10,318b — p. 244"] },
      { ref: "Ch. 11, pp. 244 & 247 — income–wealth correlation; Table 11.4",
        data: ["High saving → assets → unearned income loop — p. 244",
               "Top quintile: 62.8% of net worth vs 47.6% of gross income; bottom: 0.7% vs 4.1% — Table 11.4, p. 247",
               "Wealth Gini 0.611 vs disposable income 0.324 — Table 11.4 · life-cycle accumulation explanation — p. 247"] }
    ],
    "les-patterns": [
      { ref: "Ch. 11, pp. 245–246 — mean vs median; Figure 11.3",
        data: ["Mean $1,124/wk vs median $959/wk (2019–20); asymmetric distribution: few high incomes, many lower — pp. 245–246"] },
      { ref: "Ch. 11, pp. 248–249 — 'Dimensions in the Distribution of Income'; Table 11.5",
        data: ["AWE 2024: males $2,074 vs females $1,814 — ABS Cat. 6306.0",
               "Peak earnings 35–54 ($2,396 adult male / $1,991 adult female vs $1,734 young) — p. 248",
               "Lone persons 41.4% in lowest quintile; couples dominate the top — Table 11.5, p. 249"] },
      { ref: "Ch. 11, pp. 247 & 249 — life cycle",
        data: ["Wealth accumulated over working life, drawn down in retirement; 'twin income' young households — pp. 247, 249"] }
    ],
    "les-debate": [
      { ref: "Ch. 11, p. 249 — 'Economic and Social Benefits and Costs of Inequality'",
        data: ["Incentive effect on workers and entrepreneurs; productivity, risk-taking, wage flexibility — p. 249",
               "Saving/investment and 'growth dividend' — p. 250"] },
      { ref: "Ch. 11, p. 250 — economic and social costs",
        data: ["Keynes (1936): deficient aggregate demand corrected by redistribution — p. 250",
               "Lower consumption for low earners; higher welfare spending and budget impact; social divisions, relative poverty, 'working poor' (Gregory 1993) — p. 250"] },
      { ref: "Ch. 11, p. 250 — poverty traps",
        data: ["Welfare withdrawal + MTRs → high effective marginal tax rates (EMTRs), reduced work incentive, intergenerational dependency — p. 250"] }
    ],
    "les-policy": [
      { ref: "Ch. 11, pp. 243 & 251 — progressive taxation; Table 11.6",
        data: ["2024–25 thresholds/rates: 0% to $18,200; 16% to $45k; 30% to $135k; 37% to $190k; 45% above — p. 243 & Table 11.6, p. 251",
               "Bracket creep and the 2020 / 2024 threshold changes — p. 251"] },
      { ref: "Ch. 11, pp. 251–253 — transfers, social wage, wage floor; Table 11.7",
        data: ["Social security ≈ 37% of budget expenditure; $290.9b in 2025–26 — Table 11.7, p. 252",
               "Means-tested pensions, JobSeeker, family/disability support — pp. 251–252",
               "National Minimum Wage +3.5% to $948/wk from July 2025 (Fair Work) — p. 253"] },
      { ref: "Ch. 11, pp. 247 & 251 — effectiveness evidence",
        data: ["Gini: net worth 0.611 · gross income 0.436 · equivalised disposable 0.324 — Table 11.4, p. 247",
               "No death duties, inheritance tax or general wealth tax in Australia — p. 251"] }
    ]
  };
  window.CONTENT.areas.forEach(a => (a.lessons || []).forEach(l => {
    const refs = S[l.id]; if (refs) l.chunks.forEach((ch, i) => { if (refs[i]) ch.src = refs[i]; });
  }));
})();

// -----------------------------------------------------------------------------
// Infographic provenance — which source figure/table each chart corresponds to.
// "mirrors" = the source contains this chart; "from table" = the source presents
// this data as a table and the chart rendering is ours.
// -----------------------------------------------------------------------------
(function () {
  const F = {
    quintiles:      "From Table 11.3 (p. 245). The source presents this as a table — the bar chart rendering is ours; every value is table-exact.",
    lorenz:         "Mirrors Figure 11.1 (p. 241), extended: the income and wealth curves are plotted from the quintile data in Table 11.4 (p. 247). The source draws the generic Lorenz diagram; Figure 11.4 (p. 246) shows two curves for a different comparison.",
    incomeSources:  "Mirrors Figure 11.2 (p. 242) — same ABS 5206.0 data, redrawn as labelled bars instead of a pie.",
    wealthMix:      "From Table 11.2 (p. 244). The source presents this as a table — the chart rendering is ours; every value is table-exact.",
    incomeVsWealth: "Mirrors the Chapter Focus graph 'Shares of Income and Wealth' (p. 255), updated to the 2019–20 figures from Table 11.4 (p. 247).",
    taxBrackets:    "From Table 11.6 (p. 251) and the rates on p. 243. The source presents this as a table — the staircase chart is ours; thresholds and rates are table-exact."
  };
  window.CONTENT.areas.forEach(a => (a.lessons || []).forEach(l => l.chunks.forEach(ch => {
    if (ch.viz && F[ch.viz]) { ch.src = ch.src || { ref: "", data: [] }; ch.src.fig = F[ch.viz]; }
  })));
})();

// -----------------------------------------------------------------------------
// SOURCE-FIDELITY AUDIT: only charts that exist as charts in the resource.
// Removed: quintile bars (Table 11.3), wealth-mix bars (Table 11.2),
// tax staircase (Table 11.6) — those are tables in the source.
// -----------------------------------------------------------------------------
(function () {
  window.CONTENT.areas.forEach(a => (a.lessons || []).forEach(l => l.chunks.forEach(ch => {
    delete ch.viz; if (ch.src) delete ch.src.fig;
  })));
  const set = (lid, i, viz, fig) => {
    window.CONTENT.areas.forEach(a => (a.lessons || []).forEach(l => {
      if (l.id === lid) { l.chunks[i].viz = viz; l.chunks[i].src = l.chunks[i].src || { ref: "", data: [] }; l.chunks[i].src.fig = fig; }
    }));
  };
  set("les-measuring", 1, "lorenzFig",
    "Faithful redraw of Figure 11.1 (p. 241): the Lorenz curve, line of perfect equality, Areas A and B, and point C — same elements and labels as the source diagram.");
  set("les-income", 1, "incomePie",
    "Faithful redraw of Figure 11.2 (p. 242): same chart form (pie) and the same ABS Cat. 5206.0 values — wages 57.9%, profits 17.7%, property 12.7%, social benefits 7.7%, other 4%.");
  set("les-wealth", 2, "incomeVsWealth",
    "Corresponds to the Chapter Focus graph 'Shares of Income and Wealth' (p. 255) — same grouped-bar form, plotted with the exact 2019–20 values from Table 11.4 (p. 247).");
})();

// -----------------------------------------------------------------------------
// SENIOR-LEVEL REWRITE: chunk bodies upgraded to match the source's
// sophistication — full metalanguage, the chapter's statistics, and the
// analytical caveats — while keeping the chunked, checked structure.
// All wording original.
// -----------------------------------------------------------------------------
(function () {
  const B = {
    "les-measuring": [
      "The ABS measures the income distribution through the Survey of Income and Housing using equivalised disposable household income — gross income less direct tax, then adjusted by an equivalence scale so households of different sizes and compositions can be compared on a like-for-like basis. Households are ranked and divided into quintiles (equal 20% groupings of income units). In 2019–20 the lowest quintile received 7.4% of total equivalised disposable income (about $415 per week), the second 12.6% ($710), the third 17.2% ($966), the fourth 23.0% ($1,294) and the highest 39.8% ($2,234). The middle three quintiles — 60% of the population — received 52.8%. This degree of inequality is high but typical of OECD market economies, and the equivalisation step is what makes the comparison meaningful rather than an artefact of household size or tax paid.",
      "The Lorenz curve graphs the distribution: cumulative percentage of families or income units on the horizontal axis, cumulative percentage of income or wealth on the vertical. The curve has four defining properties: it begins at the origin (zero families earn zero income); it terminates where 100% of families receive 100% of income; the diagonal is the line of perfect equality, on which any cumulative share of families receives exactly that share of income (point C marks 60% of families receiving 60% of income); and because market distributions are unequal, real Lorenz curves lie below the diagonal. The curve's position is also the trend indicator: an inward shift toward the diagonal represents reduced inequality, an outward shift represents increased inequality — which is how changes over time, or comparisons between sub-populations, are read.",
      "The Gini coefficient converts the diagram into a single statistic: the ratio of Area A (between the line of perfect equality and the Lorenz curve) to the whole triangle beneath the diagonal (Area A + Area B). At perfect equality Area A vanishes and the coefficient is 0; at perfect inequality Area A fills the triangle and it equals 1. Movement matters as much as level: Australia's income Gini fell from 0.333 in 2013–14 to 0.324 in 2019–20 — a 2.7% decline in measured inequality attributed largely to a strengthened, better-targeted social security system — but within that period it rose from 0.323 (2015–16) to 0.328 (2017–18), most likely because high-income households gained disproportionately from growth in unearned income, before easing back. The same instrument applied to wealth yields 0.611 — nearly double."
    ],
    "les-income": [
      "Personal income is the money and the value of benefits in kind received over a period — a flow concept — in return for supplying the factors of production, or as government transfer payments. Each factor earns its own return: land earns rent, labour earns wages and salaries, capital earns interest, and enterprise earns profit. Earned income is the return to labour; unearned income — rent, interest, dividends and profit — is the return to ownership, which is why it accrues disproportionately to those who already hold wealth. Income varies across periods with a person's contribution to production and personal circumstances, which is precisely what distinguishes it from the stock of wealth.",
      "The household income account (ABS National Accounts, Cat. 5206.0) classifies sources precisely. Compensation of employees — wages, salaries and supplements such as superannuation — was 57.9% of total gross household income in 2024–25. Gross operating surplus and mixed income, the profits of incorporated and unincorporated trading enterprises, contributed 17.7%. Property income — rent, interest and dividends, much of it flowing to self-funded retirees — contributed 12.7%, and social benefits receivable 7.7%. Total gross income reached $2,264,201m, up 6.7% on 2023–24. The composition is itself a distribution story: profits grew 8.1% against 6.1% for wages, so the wages share slipped from 58.3% to 57.9% — small annual movements in factor shares that compound into the inequality trend.",
      "The tax-transfer system — the core of the government's social policy — has three elements. First, progressive taxation: the proportion of income paid in tax rises with gross income, anchored by the $18,200 tax-free threshold and marginal rates climbing from 16% to 45%. Second, transfer payments: roughly 37% of taxation revenue is redistributed as pensions, JobSeeker, family benefits and allowances to the aged, veterans and dependants, people with disabilities, low-income families, the unemployed and the sick, carers, and Indigenous Australians — with income and assets tests targeting support at genuine need. Third, the social wage: direct and subsidised provision of health (Medicare), education, housing, transport, childcare and community services, which raises low-income households' real living standards in kind rather than in cash."
    ],
    "les-wealth": [
      "Personal wealth is the net value of real and financial assets owned at a point in time — a stock concept, where income is a flow. Real (non-financial) assets include property — owner-occupied dwellings, land, home units, farms, investment properties — and consumer durables such as vehicles and household contents. Financial assets include deposits, shares, trusts, debentures, bonds and superannuation. The measure is net worth: total non-financial plus financial assets minus total financial liabilities such as mortgage and personal loans. The flow feeds the stock: saved income accumulates into assets, which is why the two distributions are linked but behave very differently over time.",
      "The ABS 2019–20 survey put total household assets at $12,356b (up 2.9% from $12,008b in 2017–18) against liabilities of $2,038b, giving aggregate net worth of $10,318b — roughly five times Australia's annual GDP. Composition explains the politics of wealth: owner-occupied and other property dominates at 56.2% of household assets, followed by superannuation (18.6%), deposits with financial institutions (6.6%), household contents (6.1%), own businesses (5.2%), shares, trusts, debentures and bonds (5.1%) and vehicles (2.2%). Mean household net worth was $1,042,000 — but the median was just $579,900, a gap that signals the same right-skew found in income, only deeper. With property the dominant asset class, dwelling prices are the single largest driver of movements in Australian wealth inequality.",
      "There is a strong correlation between the two distributions, and it runs through saving: high income earners have high saving ratios, savings accumulate as property and financial assets, and those assets generate unearned income — rent, interest, dividends and profit — which raises income further and finances more accumulation. Table 11.4 quantifies the result: the highest quintile held 62.8% of net worth (averaging $3,267,100) but a smaller 47.6% share of gross weekly income, while the lowest quintile held 0.7% of net worth ($35,100) against 4.1% of gross income. The Gini trio makes the comparison exact: 0.611 for net worth, 0.436 for gross income, 0.324 for equivalised disposable income. Part of the gap is life-cycle: wealth is accumulated across a working life and drawn down in retirement, so older households combine high net worth with low current income while younger 'twin income' households show the reverse."
    ],
    "les-patterns": [
      "The distribution of equivalised disposable household income is asymmetric: mean income in 2019–20 was $1,124 per week but the median — the midpoint when all persons are ranked by income — was $959. A mean above the median is the statistical signature of a relatively small number of very high incomes coexisting with a large number of lower ones. The mean rose 2.7% from $1,094 in 2017–18, but the gains were uneven: average income grew about 4% for middle-income households against roughly 1.2% for both low- and high-income households over the period, and about 75% of households carried mortgage debt — context that matters when interpreting 'average' prosperity.",
      "Income varies systematically along several dimensions. Gender: male average weekly earnings were $2,074 in 2024 against $1,814 for females, with the gap persisting within the same occupational categories. Occupation: managers and professionals averaged between $2,712 and $1,954 per week, against $785 to $1,238 for sales, clerical and administrative workers. Age: earnings peak in the 35–54 bracket ($2,396 for adult males, $1,991 for adult females) against $1,734 for 21–34 year-olds, and employment status compounds this — casual and part-time workers earn far less than full-time employees. Ethnicity: migrants from English-speaking countries out-earn more recent arrivals, longer residency lifts income, and Indigenous Australians remain among the lowest income earners, with many reliant on transfer payments. These dimensions overlap, which is how disadvantage concentrates.",
      "Family structure and the life cycle organise much of the distribution. Households move through formation, maturation and dissolution — from young singles through couples with and without dependent children to single parents and the elderly — and income capacity moves with them. In 2019–20, 41.4% of lone-person households sat in the lowest quintile (mean $938 per week) and 37.7% of one-parent families ($789), while couples without dependent children were the most represented in the highest quintile (28.4%, $1,242), typically dual wage-earners. One analytical subtlety the ABS data reveals: sub-populations are usually more homogeneous than the whole, so inequality measured within a group is generally lower — persons in lone-parent households had a Gini of 0.307 against 0.333 for the full population, even though that group is poorer on average."
    ],
    "les-debate": [
      "The case for tolerating some inequality is an efficiency argument. Differential rewards create the incentive effect: employees pursue higher pay through education, training, skill acquisition and productivity, and may work longer hours at the cost of leisure; entrepreneurs accept risk because profit rewards are commensurate. Relative wage flexibility improves labour mobility and allocates labour more efficiently. Higher incomes also lift national saving and investment, financing capital accumulation and technological progress that expand productive capacity — and a growing economy generates the 'growth dividend' of tax revenue that can fund targeted welfare. The factor-share evidence cuts both ways: low wages growth of 2–3% accompanied rising inequality in 2021–22, with the capital share of GDP (profits, rent, interest, dividends) at 29.2% against a wages share of 55.8%.",
      "The costs are macroeconomic, fiscal and social. Keynes (1936) argued that concentrating income where the propensity to save is highest produces deficient aggregate demand, correctable through redistributive policy — the opportunity cost of inequality is the consumption and utility forgone by low-income earners. Fiscally, greater inequality drives higher social welfare spending, a heavier tax burden, and a weaker budget position through larger deficits or smaller surpluses. Socially, divisions emerge along income lines: groups whose members rely on welfare — Indigenous Australians, the unemployed, single parents, large low-income families, aged pensioners — can be alienated from market opportunity while some taxpayers resent funding support. Gregory's (1993) research identified a 'working poor' dependent on annual adjustments to Modern Awards and the National Minimum Wage, and casualisation plus a decentralised industrial relations system has marginalised an underclass of workers. Relative poverty remains the major social cost.",
      "The sharpest design problem sits where the welfare and tax systems interact. A person's incentive to seek and retain work depends on the rate at which income support is withdrawn as earnings rise, eligibility for concessions such as rent assistance, and the marginal tax rate applying to new earnings. Together these can produce very high effective marginal tax rates (EMTRs) — poverty traps in which additional work yields little additional disposable income, entrenching welfare dependency that can become intergenerational. Policy has responded on both margins: between 2000 and 2024 governments cut marginal rates for low-income earners, raised tax thresholds, and reformed welfare eligibility to strengthen the financial return from paid work — evidence that the architecture of redistribution matters as much as its scale."
    ],
    "les-policy": [
      "Progressive taxation is the revenue side of redistribution. From 1 July 2024 the resident scale is: nil to $18,200; 16% from $18,201–$45,000; 30% from $45,001–$135,000; 37% from $135,001–$190,000; and 45% above $190,001 — the Stage Three changes cut the 19% rate to 16% and 32.5% to 30%, and lifted two thresholds. Threshold adjustment is the antidote to bracket creep: with thresholds fixed in dollars, nominal wage growth drags earners into higher brackets and raises average tax rates without real income gains, so the 2012–13 (tax-free threshold from $6,000 to $18,200), 2020 and 2024 reforms each handed back accumulated creep. Wealth, by contrast, is taxed only obliquely — fringe benefits tax and capital gains tax apply progressive rates to some returns on wealth, but Australia has no death duties, inheritance tax or general wealth tax, which is why debate continues over the CGT discount and negative gearing.",
      "The expenditure side combines targeted transfers, a wage floor and the social wage. Social security and welfare absorbs around 37% of budget expenditure — $290.9b in 2025–26, led by assistance to the aged ($109.5b), people with disabilities ($90.9b) and families with children ($52.5b) — delivered through income- and assets-tested payments so support reaches demonstrated need. The wage floor protects those with least bargaining power: the Fair Work Commission lifted the National Minimum Wage 3.5% ($32.10) to $948 per week from 1 July 2025 to defend real wages after the 2022–24 inflation, within the architecture of Modern Awards, the ten National Employment Standards and the Better Off Overall Test created by the Fair Work Act 2009. Around these sit the social wage services — Medicare, public education, housing, transport, community services — provided federally and through state subsidy.",
      "Effectiveness should be judged against evidence, and the evidence splits. On income, the system demonstrably compresses the distribution every year: the Gini for gross household income (0.436) falls to 0.324 once taxes and transfers produce equivalised disposable income — and in crises the system scales fast, as in 2020's $750 payments to welfare recipients, the $550 coronavirus supplement and JobKeeper at $1,500 per employee per fortnight, or the GFC-era Economic Security Strategy and $30b Nation Building program. On wealth, it barely operates: with no general wealth taxation the net worth Gini sits at 0.611, roughly double the income figure. The recurring design weaknesses are high EMTRs creating poverty traps and bracket creep between reforms, while the Intergenerational Reports (2015, 2021, 2023) point to demographic pressure — including NDIS growth ($13.2b additional) and aged care ($17.7b) — that will keep testing the system's fiscal base."
    ]
  };
  window.CONTENT.areas.forEach(a => (a.lessons || []).forEach(l => {
    const bodies = B[l.id];
    if (bodies) l.chunks.forEach((ch, i) => { if (bodies[i]) ch.body = bodies[i]; });
  }));
})();

// -----------------------------------------------------------------------------
// STAGED LESSON REDESIGN: every chunk rebuilt as a staged sequence —
// principle → progressive build → evidence (explorables + stat tiles) →
// scenario → synthesis. Senior content preserved; structure does the
// cognitive-load work. Checks and source refs are kept; provenance updated
// for the interactives. All wording original.
// -----------------------------------------------------------------------------
(function () {
  const S = {
    "les-measuring": [
      { kind: "intro",
        fig: "Interactive presentation of Table 11.3 (p. 245) — every value is table-exact; the staged $100 split is our rendering of the table.",
        blocks: [
          { t: "lead", x: "Before you can argue about inequality you have to measure it — and every measurement choice is itself an economic judgement." },
          { t: "reveal", cta: "Build the measure", steps: [
            { label: "Start with gross income.", text: "Everything a household receives: wages and salaries, profits, rent, interest, dividends and transfer payments." },
            { label: "Subtract direct tax → disposable income.", text: "What households can actually spend or save — the income concept that matters for living standards." },
            { label: "Equivalise → comparable households.", text: "An ABS equivalence scale adjusts for household size and composition, so a lone person and a family of five compare like-for-like. The result — equivalised disposable household income, from the Survey of Income and Housing — is the measure behind every figure in this topic." }]},
          { t: "int", key: "quintileSplit" },
          { t: "stats", items: [
            { n: "52.8%", l: "share received by the middle 60% of households" },
            { n: "$415 vs $2,234", l: "weekly income, lowest vs highest quintile (2019–20)" }]},
          { t: "p", x: "This degree of inequality is high but typical of OECD market economies — and the equivalisation step is what makes the comparison meaningful rather than an artefact of household size or tax paid." }]},
      { kind: "evidence",
        fig: "Interactive model of Figure 11.1 (p. 241) — the source diagram's own construction made manipulable. The Gini readout is computed from the model curve; the presets sit at the chapter's measured values (income 0.32, wealth 0.61).",
        blocks: [
          { t: "lead", x: "The Lorenz curve turns those shares into a picture — and the picture into an instrument." },
          { t: "int", key: "lorenzInteractive" },
          { t: "reveal", cta: "The curve's four properties", steps: [
            { label: "It begins at the origin.", text: "Zero per cent of income units receive zero per cent of income." },
            { label: "It terminates at (100, 100).", text: "All income units together receive all income — every Lorenz curve shares both endpoints." },
            { label: "The diagonal is perfect equality.", text: "On the 45° line, any cumulative share of income units receives exactly that share of income — point C marks 60% of units receiving 60%." },
            { label: "Real curves sag below.", text: "Market distributions are unequal, so the curve bows away from the diagonal. Read movement, not just position: an inward shift toward the diagonal means reduced inequality; outward means increased." }]}]},
      { kind: "synthesis",
        fig: "Faithful redraw of Figure 11.1 (p. 241): the Lorenz curve, line of perfect equality, Areas A and B, and point C — the same elements and labels as the source diagram.",
        blocks: [
          { t: "lead", x: "The Gini coefficient compresses the whole diagram into a single ratio: Area A divided by the entire triangle beneath the diagonal (Area A + Area B). Zero is perfect equality; one is perfect inequality." },
          { t: "viz", key: "lorenzFig" },
          { t: "stats", items: [
            { n: "0.324", l: "income Gini, 2019–20 (equivalised disposable)" },
            { n: "0.333", l: "income Gini, 2013–14" },
            { n: "0.611", l: "wealth Gini — nearly double income" }]},
          { t: "reveal", cta: "Read the trend like an economist", steps: [
            { label: "2013–14 → 2019–20: 0.333 → 0.324.", text: "A 2.7% fall in measured income inequality, attributed largely to a strengthened, better-targeted social security system." },
            { label: "But 2015–16 → 2017–18: 0.323 → 0.328.", text: "Inside the fall, a rise — most plausibly high-income households gaining disproportionately from growth in unearned income, before the trend eased back." },
            { label: "The instrument is general.", text: "Apply the same tool to net worth and it reads 0.611 — one measure exposing a far less equal distribution." }]},
          { t: "scenario", q: "A country's Gini rises from 0.30 to 0.36 over a decade while median income also rises strongly. What can you conclude?",
            opts: [
              { t: "Inequality increased even though typical living standards improved", ok: true, why: "The Gini measures dispersion, not levels — both statements are true at once, which is exactly why economists report distribution and level together." },
              { t: "Living standards must have fallen for most people", ok: false, why: "A rising median says the typical household gained; the Gini says the gains were spread less equally. Different dimensions." },
              { t: "The data must be inconsistent", ok: false, why: "Distribution and level are independent — there is no contradiction to resolve." }]}]}
    ],
    "les-income": [
      { kind: "intro", blocks: [
          { t: "lead", x: "Income is a flow — money and benefits in kind received over a period in return for supplying the factors of production, or as government transfers." },
          { t: "reveal", cta: "The four factor returns", steps: [
            { label: "Land earns rent.", text: "The return to natural resources and property ownership." },
            { label: "Labour earns wages and salaries.", text: "The only earned income in the set — the rest reward ownership rather than work." },
            { label: "Capital earns interest.", text: "The return to lending and to holding financial assets." },
            { label: "Enterprise earns profit.", text: "The reward for organising production and bearing risk." }]},
          { t: "p", x: "The earned/unearned distinction does real analytical work: unearned income — rent, interest, dividends and profit — accrues to those who already hold assets, which is how the income and wealth distributions reinforce each other." }]},
      { kind: "evidence", blocks: [
          { t: "lead", x: "The national accounts name the parts precisely — and the proportions decide whose income growth moves the whole distribution." },
          { t: "viz", key: "incomePie" },
          { t: "stats", items: [
            { n: "$2,264,201m", l: "total gross household income 2024–25 (+6.7%)" },
            { n: "58.3% → 57.9%", l: "wages share of income, 2023–24 → 2024–25" },
            { n: "+8.1% vs +6.1%", l: "growth in profits vs growth in wages" }]},
          { t: "p", x: "The categories matter for precision: compensation of employees covers wages, salaries and supplements such as superannuation; gross operating surplus and mixed income is the profits of incorporated and unincorporated enterprises; property income — rent, interest and dividends — flows substantially to self-funded retirees. Small annual movements in these factor shares compound into the inequality trend." }]},
      { kind: "synthesis", blocks: [
          { t: "lead", x: "The tax-transfer system is the architecture that converts market income into disposable income." },
          { t: "reveal", cta: "The three elements", steps: [
            { label: "Progressive taxation.", text: "Nothing on the first $18,200, marginal rates rising from 16% to 45% — so the average rate climbs with income." },
            { label: "Transfer payments.", text: "Roughly 37% of taxation revenue is redistributed as pensions, JobSeeker, family and disability support — income- and assets-tested so support targets demonstrated need." },
            { label: "The social wage.", text: "Health (Medicare), education, housing, transport and childcare provided or subsidised in kind — redistribution that never appears in a pay packet." }]},
          { t: "stats", items: [{ n: "≈37%", l: "of taxation revenue redistributed as transfer payments" }]},
          { t: "scenario", q: "A retired couple owns their home outright, holds modest superannuation, and receives a part Age Pension plus Medicare-funded healthcare. Which elements of the system are working on their position?",
            opts: [
              { t: "Transfers and the social wage — with the assets test calibrating the pension to their wealth", ok: true, why: "The part pension is a means-tested transfer, Medicare is the social wage in kind, and the assets test is the targeting mechanism doing the calibration." },
              { t: "Only progressive taxation", ok: false, why: "With little taxable income the tax scale barely touches them — their support arrives through transfers and services." },
              { t: "None — retirees sit outside the system", ok: false, why: "Assistance to the aged is the single largest category of social security spending." }]}]}
    ],
    "les-wealth": [
      { kind: "intro", blocks: [
          { t: "lead", x: "Where income flows, wealth sits: net worth is the value of everything a household owns minus everything it owes, measured at a point in time." },
          { t: "reveal", cta: "Build the balance sheet", steps: [
            { label: "Add the real assets.", text: "Property — owner-occupied dwellings, land, investment property — plus consumer durables such as vehicles and household contents." },
            { label: "Add the financial assets.", text: "Deposits, shares, trusts, debentures, bonds and superannuation." },
            { label: "Subtract the liabilities.", text: "Mortgage and personal debt. What remains is net worth — the household balance sheet in one number." }]},
          { t: "p", x: "The flow feeds the stock: saved income accumulates into assets. That is why the two distributions are linked — and why they behave so differently over time." }]},
      { kind: "evidence",
        fig: "Interactive presentation of Table 11.2 (p. 244) — segment values are table-exact (share and $b); the tappable composition bar is our rendering of the table.",
        blocks: [
          { t: "lead", x: "Australia's household balance sheet, one tap at a time — property's dominance is the single most important fact in it." },
          { t: "int", key: "wealthExplore" },
          { t: "stats", items: [
            { n: "$10,318b", l: "household net worth 2019–20 — about five times annual GDP" },
            { n: "$1,042,000 vs $579,900", l: "mean vs median net worth: the skew, again" }]},
          { t: "p", x: "Property's 56.2% share is the politics of Australian wealth: when dwelling prices move, wealth inequality moves with them, because the gains accrue to those who already own." }]},
      { kind: "synthesis", blocks: [
          { t: "lead", x: "Income and wealth reinforce each other through one mechanism: saving." },
          { t: "reveal", cta: "Trace the loop", steps: [
            { label: "High income → high saving ratio.", text: "Top earners save a much larger fraction of each extra dollar." },
            { label: "Saving → assets.", text: "Savings accumulate as property and financial assets." },
            { label: "Assets → unearned income.", text: "Rent, interest, dividends and profit flow from ownership." },
            { label: "Unearned income → more assets.", text: "The flow finances further accumulation — and low earners can never start the loop. Wealth also compounds across lifetimes and passes between generations, while income is partly equalised every single year." }]},
          { t: "viz", key: "incomeVsWealth" },
          { t: "stats", items: [
            { n: "0.611 / 0.436 / 0.324", l: "Gini: net worth / gross income / disposable income" },
            { n: "62.8% vs 47.6%", l: "top quintile: share of net worth vs share of gross income" }]},
          { t: "p", x: "Part of the gap is life-cycle rather than class: wealth built over a working life is drawn down in retirement, so older households pair high net worth with low current income while young 'twin income' households show the reverse." }]}
    ],
    "les-patterns": [
      { kind: "intro", blocks: [
          { t: "lead", x: "When the mean sits above the median, a small number of very high values is stretching the average upward — the statistical signature of a right-skewed distribution." },
          { t: "stats", items: [
            { n: "$1,124", l: "mean weekly income, 2019–20" },
            { n: "$959", l: "median — the typical household" },
            { n: "≈75%", l: "of households carried mortgage debt" }]},
          { t: "reveal", cta: "Why the gap exists", steps: [
            { label: "A long upper tail.", text: "A relatively small number of very high incomes lifts the mean while leaving the median untouched." },
            { label: "The median is anchored.", text: "It marks the middle household however extreme the top becomes — which is why it tracks 'typical' living standards better than the average does." },
            { label: "Growth was uneven.", text: "From 2017–18 to 2019–20, middle-income households gained about 4% while low- and high-income households gained roughly 1.2% each — the mean rose 2.7% from $1,094." }]}]},
      { kind: "evidence", blocks: [
          { t: "lead", x: "Income varies systematically — by gender, occupation, age, background and household type — and the dimensions overlap, which is how disadvantage concentrates." },
          { t: "reveal", cta: "Walk the dimensions", steps: [
            { label: "Gender.", text: "Male average weekly earnings were $2,074 in 2024 against $1,814 for females — and the gap persists within the same occupational categories." },
            { label: "Occupation.", text: "Managers and professionals averaged $1,954–$2,712 a week against $785–$1,238 for sales, clerical and administrative workers." },
            { label: "Age.", text: "Earnings peak at 35–54 ($2,396 for adult males, $1,991 for adult females) against $1,734 for 21–34 year-olds — the life-cycle profile in cross-section." },
            { label: "Background and status.", text: "Migrants from English-speaking countries out-earn recent arrivals, longer residency lifts income, Indigenous Australians remain among the lowest income earners, and casual or part-time status compounds every other gap." }]},
          { t: "stats", items: [
            { n: "41.4%", l: "of lone-person households sit in the lowest quintile" },
            { n: "37.7%", l: "of one-parent families in the lowest quintile" },
            { n: "28.4%", l: "of couples without dependent children in the highest" }]}]},
      { kind: "synthesis", blocks: [
          { t: "lead", x: "Much apparent inequality is the life cycle in motion — households moving through formation, accumulation and retirement." },
          { t: "reveal", cta: "Follow a household through", steps: [
            { label: "Young households.", text: "Moderate incomes and few assets, often renting — dual-earner 'twin income' couples are the exception that climbs fast." },
            { label: "Peak years, 35–54.", text: "The highest earnings finance the mortgage and superannuation — the accumulation phase of the balance sheet." },
            { label: "Retirement.", text: "Income falls but accumulated net worth remains and is gradually drawn down — low income, high wealth." }]},
          { t: "scenario", q: "A retired couple in a paid-off home and a young renting couple report the same weekly income. Are they equally well off?",
            opts: [
              { t: "No — the retirees hold accumulated wealth and pay no rent, so equal income masks unequal positions", ok: true, why: "Income alone misclassifies them. The stock (net worth) and housing costs transform the comparison — the core reason analysts read income and wealth together." },
              { t: "Yes — equal income means equal living standards", ok: false, why: "Housing costs and the wealth stock differ radically; a flow measure alone cannot see it." },
              { t: "The young couple is better off because they will earn for longer", ok: false, why: "Future earning capacity is real but speculative — their current positions still differ in wealth and costs." }]},
          { t: "p", x: "One analytical subtlety worth quoting in an essay: sub-populations are usually more homogeneous than the whole population, so inequality measured within a group is generally lower — persons in lone-parent households had a Gini of 0.307 against 0.333 overall, even though the group is poorer on average." }]}
    ],
    "les-debate": [
      { kind: "intro", blocks: [
          { t: "lead", x: "The case for tolerating some inequality is an efficiency argument: differential rewards are claimed to drive effort, risk-taking and growth." },
          { t: "reveal", cta: "The incentive chain", steps: [
            { label: "Rewards → skills and effort.", text: "Higher pay motivates education, training, skill acquisition and productivity — and willingness to work longer hours at the cost of leisure." },
            { label: "Wage flexibility → mobility.", text: "Relative wage differences move labour to where it is most valued — allocative efficiency in the labour market." },
            { label: "Profit → risk-taking.", text: "Entrepreneurs accept risk because the rewards are commensurate with it." },
            { label: "Saving → investment → the growth dividend.", text: "Higher incomes lift national saving, financing capital accumulation and technological progress — and a growing economy generates the tax revenue that can fund targeted welfare." }]},
          { t: "stats", items: [
            { n: "55.8% vs 29.2%", l: "wages vs capital share of GDP, 2021–22" },
            { n: "2–3%", l: "the low wage growth that accompanied rising inequality" }]}]},
      { kind: "evidence", blocks: [
          { t: "lead", x: "Against efficiency sit macroeconomic, fiscal and social costs — and they compound." },
          { t: "reveal", cta: "Keynes's mechanism, step by step", steps: [
            { label: "Low earners spend more of each dollar.", text: "The marginal propensity to consume falls as income rises." },
            { label: "Concentration shifts income toward savers.", text: "Move income up the distribution and total consumption falls below what a more equal distribution would generate." },
            { label: "Deficient aggregate demand.", text: "Keynes (1936) drew the conclusion: redistribution toward lower incomes is demand policy as well as equity policy." }]},
          { t: "p", x: "The fiscal cost runs through welfare spending, the tax burden and the budget balance; the social cost runs through divisions, the alienation of marginalised groups and relative poverty — the major social cost. Gregory's (1993) research identified a 'working poor' dependent on annual adjustments to Modern Awards and the National Minimum Wage, and casualisation under a decentralised industrial relations system has marginalised an underclass of workers." }]},
      { kind: "synthesis", blocks: [
          { t: "lead", x: "The sharpest design problem sits where welfare withdrawal meets the tax scale: effective marginal tax rates." },
          { t: "reveal", cta: "Assemble an EMTR", steps: [
            { label: "Earn an extra dollar.", text: "Marginal tax applies — say 16 cents at the lowest rate." },
            { label: "Support withdraws.", text: "Income-tested payments taper — often around 50 cents in the dollar." },
            { label: "Concessions lapse.", text: "Rent assistance and concession-card eligibility can vanish at thresholds." },
            { label: "The effective rate stacks.", text: "16 + 50 + lost concessions can push the effective marginal tax rate toward or past 70% — the poverty trap, with the risk of intergenerational welfare dependency." }]},
          { t: "scenario", q: "A JobSeeker recipient is offered an extra shift worth $100. Their payment tapers at 50c per dollar earned and their marginal tax rate is 16%. Roughly how much do they keep?",
            opts: [
              { t: "About $34 — an EMTR of roughly 66%", ok: true, why: "$50 withdrawn plus $16 tax leaves $34. That arithmetic, repeated every week, is the disincentive the chapter calls a poverty trap." },
              { t: "$84 — only the tax applies", ok: false, why: "The benefit taper is the larger leak: withdrawal and tax stack together into the effective rate." },
              { t: "$100 — extra work is always kept", ok: false, why: "Means-testing exists precisely to withdraw support as private income rises — that is the mechanism under examination." }]},
          { t: "p", x: "Policy has worked both margins between 2000 and 2024 — marginal rate cuts for low earners, threshold rises and welfare reform strengthening the financial return from paid work — evidence that the architecture of redistribution matters as much as its scale." }]}
    ],
    "les-policy": [
      { kind: "intro",
        fig: "Calculator built on the rates and thresholds in Table 11.6 (p. 251) and p. 243. No chart exists in the source — this computes with the table's values rather than depicting them.",
        blocks: [
          { t: "lead", x: "Progressive taxation means each successive slice of income faces a higher rate — the average rate climbs with income while every taxpayer keeps the same tax-free base." },
          { t: "int", key: "taxCalc" },
          { t: "reveal", cta: "What changed, and why it matters", steps: [
            { label: "Stage Three, from July 2024.", text: "The 19% rate fell to 16% and 32.5% to 30%, with thresholds lifted to $135,000 and $190,000." },
            { label: "Bracket creep is the silent rate rise.", text: "With thresholds fixed in dollars, nominal wage growth drags earners into higher brackets and lifts average rates with no real income gain — threshold reform hands the accumulated creep back. The largest single correction raised the tax-free threshold from $6,000 to $18,200 in 2012–13." }]},
          { t: "p", x: "Wealth, by contrast, is taxed only obliquely — fringe benefits tax and capital gains tax apply progressive rates to some returns on wealth — and Australia levies no death duties, inheritance tax or general wealth tax, which keeps the CGT discount and negative gearing in permanent policy debate." }]},
      { kind: "evidence", blocks: [
          { t: "lead", x: "The expenditure side rests on three pillars: targeted transfers, a wage floor, and the social wage." },
          { t: "stats", items: [
            { n: "$290.9b", l: "social security spending 2025–26 — about 37% of the budget" },
            { n: "$109.5b / $90.9b / $52.5b", l: "aged / disability / families: the three largest programs" },
            { n: "$948", l: "National Minimum Wage per week from July 2025 (+3.5%)" }]},
          { t: "reveal", cta: "The three pillars", steps: [
            { label: "Targeted transfers.", text: "Income- and assets-tested pensions and allowances concentrate limited revenue on demonstrated need." },
            { label: "The wage floor.", text: "The Fair Work Commission lifted the National Minimum Wage by $32.10 to $948 to defend real wages after the 2022–24 inflation — inside the architecture of Modern Awards, the ten National Employment Standards and the Better Off Overall Test created by the Fair Work Act 2009." },
            { label: "The social wage.", text: "Medicare, public education, housing and transport — redistribution in kind, provided federally and through state subsidy." }]}]},
      { kind: "synthesis", blocks: [
          { t: "lead", x: "Judge the system on evidence, and the evidence splits: powerful on income, nearly silent on wealth." },
          { t: "stats", items: [
            { n: "0.436 → 0.324", l: "Gini, gross income → disposable income: the system's annual compression" },
            { n: "0.611", l: "wealth Gini — largely untouched, with no general wealth taxation" }]},
          { t: "reveal", cta: "Stress tests: crisis capability", steps: [
            { label: "COVID, 2020.", text: "$750 payments to welfare recipients, the $550 coronavirus supplement and JobKeeper at $1,500 per fortnight — the transfer system scaled within weeks." },
            { label: "The GFC, 2008–09.", text: "The Economic Security Strategy's cash payments and the $30b Nation Building program cushioned aggregate demand through the downturn." }]},
          { t: "scenario", q: "An essay asks you to assess the effectiveness of the tax-transfer system. Which verdict best matches the evidence?",
            opts: [
              { t: "Effective at compressing income inequality each year; structurally weak on wealth", ok: true, why: "0.436 → 0.324 is direct, repeatable evidence on income; a 0.611 wealth Gini with no wealth taxation is the standing gap." },
              { t: "It has failed, because inequality still exists", ok: false, why: "Elimination is not the benchmark — the measured annual compression is large, and crisis episodes show the system scales." },
              { t: "It works identically on income and wealth", ok: false, why: "There is no general wealth taxation; the wealth distribution remains nearly twice as unequal as income." }]},
          { t: "p", x: "The recurring design weaknesses are high effective marginal tax rates and bracket creep between reforms — and the Intergenerational Reports (2015, 2021, 2023) point to demographic pressures, NDIS growth (+$13.2b) and aged care spending ($17.7b) that will keep testing the system's fiscal base." }]}
    ]
  };
  window.CONTENT.areas.forEach(a => (a.lessons || []).forEach(l => {
    const specs = S[l.id]; if (!specs) return;
    l.chunks.forEach((ch, i) => {
      const sp = specs[i]; if (!sp) return;
      ch.kind = sp.kind; ch.blocks = sp.blocks;
      delete ch.viz; delete ch.body;
      if (sp.fig) { ch.src = ch.src || { ref: "", data: [] }; ch.src.fig = sp.fig; }
    });
  }));
})();

// -----------------------------------------------------------------------------
// MASTERY LADDER: each lesson rebuilt as 4 levels of single-focus steps —
// Foundations → Evidence → Skills (calculate) → Economist (interpret in writing).
// Existing blocks are redistributed by reference; every prior check is reused;
// new calculation + short-answer tasks add varied retrieval of the same skills.
// All values table-exact; all wording original.
// -----------------------------------------------------------------------------
(function () {
  const bb = (c, ...is) => is.map(i => c.blocks[i]);
  const ck = c => ({ type: "check", q: c.check.q, opts: c.check.opts });
  const sc = b => ({ type: "scenario", q: b.q, opts: b.opts });
  const ref = (label, key, kind) => ({ t: "ref", label, key, kind: kind || "viz" });
  const p = x => ({ t: "p", x });

  const build = {
    "les-measuring": c => [
      { name: "Foundations — the measure", kind: "foundations",
        src: { ref: "Ch. 11, p. 245 — 'Trends in the Distribution of Income and Wealth' & Table 11.3",
          data: ["Equivalised disposable household income via the Survey of Income and Housing — p. 245",
                 "Quintile shares 7.4 / 12.6 / 17.2 / 23.0 / 39.8% with weekly values — Table 11.3 (ABS Cat. 6523.0)"],
          fig: "Interactive presentation of Table 11.3 — values table-exact; the staged $100 split is our rendering." },
        steps: [
          { h: "The measure behind every number", blocks: bb(c[0], 0, 1),
            task: { type: "short", q: "In one sentence: why does the ABS equivalise disposable income before comparing households?",
              vocab: [{ t: "size", d: "household size" }, { t: "composition", d: "composition" }, { t: "compar", d: "comparability" }],
              model: "Equivalisation adjusts disposable income for household size and composition, so households of different shapes can be compared like-for-like." } },
          { h: "Splitting the national income", blocks: bb(c[0], 2, 3), task: ck(c[0]) }]},
      { name: "Evidence — the Lorenz instrument", kind: "evidence2",
        src: { ref: "Ch. 11, p. 241 — Figure 11.1 and the curve's properties",
          data: ["Four defining properties: origin, terminus at (100,100), the 45° equality line with point C, real curves below — p. 241",
                 "Inward shift = reduced inequality; outward = increased — p. 241"],
          fig: "Interactive model of Figure 11.1 — the construction made manipulable; presets sit at the chapter's measured Ginis (0.32 income, 0.61 wealth)." },
        steps: [
          { h: "Drag the inequality", blocks: bb(c[1], 0, 1), task: ck(c[1]) },
          { h: "Reading curves like text", blocks: [c[1].blocks[2], ref("Open Figure 11.1 for reference", "lorenzFig")],
            task: { type: "short", q: "A country's Lorenz curve shifts inward over a decade. Interpret the shift in one sentence.",
              vocab: [{ t: "inward", d: "inward shift" }, { t: "equal", d: "equality line" }, { t: "inequal", d: "inequality fell" }],
              model: "An inward shift toward the line of perfect equality means inequality has fallen — lower income units now hold a larger cumulative share of total income." } }]},
      { name: "Skills — calculate the coefficients", kind: "skills",
        src: { ref: "Ch. 11, pp. 241–242, 245 & 247 — Gini construction; Tables 11.3 & 11.4",
          data: ["Gini = Area A ÷ (Area A + Area B) — p. 241", "Income Gini 0.324 (Table 11.3); net worth 0.611, top-quintile shares 62.8% vs 47.6% (Table 11.4)"],
          fig: "Reference charts open on demand; every calculator task uses table-exact values." },
        steps: [
          { h: "Warm-up: which way is worse?", blocks: [], task: ck(c[2]) },
          { h: "Compute a Gini", blocks: [p("The ABS computes the coefficient from the areas of the diagram. Do the calculation the Bureau does:"), ref("Open the Lorenz diagram", "lorenzFig")],
            task: { type: "calc", q: "Area A = 0.162 and Area B = 0.338. Calculate the Gini coefficient (3 decimal places).",
              expected: 0.324, tol: 0.0011, working: "Gini = A ÷ (A + B) = 0.162 ÷ 0.500 = 0.324 — Australia's actual 2019–20 income figure." } },
          { h: "Plot a Lorenz point", blocks: [ref("Reopen the $100 split", "quintileSplit", "int")],
            task: { type: "calc", q: "Using Table 11.3 (7.4, 12.6, 17.2, 23.0, 39.8), what cumulative percentage of income do the bottom 60% of households receive? (1 dp)",
              expected: 37.2, tol: 0.1, working: "7.4 + 12.6 + 17.2 = 37.2% — the third point you would plot when drawing the Lorenz curve." } },
          { h: "Quantify the wealth gap", blocks: [],
            task: { type: "calc", q: "The top quintile holds 62.8% of net worth and 47.6% of gross income (Table 11.4). Wealth share ÷ income share = ? (2 dp)",
              expected: 1.32, tol: 0.01, working: "62.8 ÷ 47.6 ≈ 1.32 — the top quintile's wealth share runs about a third larger than its income share." } }]},
      { name: "Economist — interpret and argue", kind: "economist",
        src: { ref: "Ch. 11, pp. 245 & 247 — the Gini trend and the income–wealth contrast",
          data: ["Trend 0.333 → 0.323 → 0.328 → 0.324 with attributed causes — p. 245", "0.611 / 0.436 / 0.324 — Table 11.4, p. 247"] },
        steps: [
          { h: "Two Ginis, one story", blocks: [c[2].blocks[2]],
            task: { type: "short", q: "Income Gini 0.324; wealth Gini 0.611. Write the two-sentence interpretation an examiner rewards.",
              vocab: [{ t: "wealth", d: "wealth" }, { t: "double", d: "nearly double" }, { t: "accumulat", d: "accumulation" }, { t: "tax", d: "tax-transfer" }],
              model: "Wealth is distributed almost twice as unequally as income — 0.611 against 0.324. Wealth compounds across lifetimes and is barely taxed, while the tax-transfer system re-equalises income every year, so the stock diverges from the flow." } },
          { h: "Hold two truths at once", blocks: [c[2].blocks[3]], task: sc(c[2].blocks[4]) }]}
    ],
    "les-income": c => [
      { name: "Foundations — what counts as income", kind: "foundations",
        src: { ref: "Ch. 11, p. 242 — 'The Sources of Income'",
          data: ["Income as a flow; factor returns: land→rent, labour→wages, capital→interest, enterprise→profit — p. 242"] },
        steps: [
          { h: "Income is a flow", blocks: bb(c[0], 0, 1), task: ck(c[0]) },
          { h: "Earned and unearned", blocks: [c[0].blocks[2]],
            task: { type: "short", q: "Distinguish earned from unearned income, with one example of each.",
              vocab: [{ t: "labour", d: "labour" }, { t: "ownership", d: "ownership" }, { t: "rent", d: "rent/interest/dividends" }, { t: "wage", d: "wages" }],
              model: "Earned income is the return to labour — wages, salaries and overtime from work performed. Unearned income is the return to ownership — rent, interest, dividends and profit flowing from assets held." } }]},
      { name: "Evidence — the national accounts", kind: "evidence2",
        src: { ref: "Ch. 11, p. 242 — Figure 11.2 & Table 11.1",
          data: ["Wages 57.9%, profits 17.7%, property 12.7%, social benefits 7.7%, other 4% — ABS Cat. 5206.0",
                 "Total $2,264,201m (+6.7%); wages share 58.3% → 57.9%; profits +8.1% vs wages +6.1% — Table 11.1"],
          fig: "Faithful redraw of Figure 11.2 — same pie form, same values." },
        steps: [
          { h: "What households actually receive", blocks: bb(c[1], 0, 1, 2), task: ck(c[1]) },
          { h: "Naming the parts precisely", blocks: [c[1].blocks[3]],
            task: { type: "short", q: "An exam answer says 'wages'. The national accounts use a more precise category — name it and say what it includes.",
              vocab: [{ t: "compensation", d: "compensation of employees" }, { t: "superannuation", d: "superannuation" }, { t: "salar", d: "salaries" }],
              model: "Compensation of employees — wages and salaries plus supplements such as employer superannuation contributions. Using the accounts' own category is the metalanguage examiners reward." } }]},
      { name: "Skills — size the flows", kind: "skills",
        src: { ref: "Ch. 11, pp. 242–243 — Table 11.1 values",
          data: ["Total gross household income $2,264,201m in 2024–25 — Table 11.1"] },
        steps: [
          { h: "Social benefits in dollars", blocks: [ref("Open Figure 11.2 (income sources)", "incomePie")],
            task: { type: "calc", q: "Social benefits are 7.7% of total gross household income of $2,264,201m. Value in $m? (nearest $m; tolerance applies)",
              expected: 174344, tol: 400, working: "7.7% × $2,264,201m ≈ $174,344m." } },
          { h: "Wages in dollars", blocks: [],
            task: { type: "calc", q: "Compensation of employees is 57.9% of the same total. Value in $m?",
              expected: 1310972, tol: 600, working: "57.9% × $2,264,201m ≈ $1,310,972m — well over half of everything households receive." } },
          { h: "Redistribution at the margin", blocks: [], task: ck(c[2]) }]},
      { name: "Economist — read the factor shares", kind: "economist",
        src: { ref: "Ch. 11, pp. 242–243 — factor shares and the tax-transfer system",
          data: ["Wages share 58.3% → 57.9%; profits +8.1% vs wages +6.1% — Table 11.1", "Three elements of the tax-transfer system — p. 243"] },
        steps: [
          { h: "Why 0.4 points matters", blocks: [c[1].blocks[2]],
            task: { type: "short", q: "Wages still dominate household income, yet the wages share slipping 58.3% → 57.9% matters for distribution. Explain in two sentences.",
              vocab: [{ t: "profit", d: "profits" }, { t: "unearned", d: "unearned income" }, { t: "concentrat", d: "concentration" }, { t: "compound", d: "compounds" }],
              model: "Wages are the most evenly spread source, while profits and property income concentrate among high-wealth households — so a shift of even 0.4 points from wages toward profits tilts total income toward the top. Repeated annually, small factor-share shifts compound into the inequality trend." } },
          { h: "Apply the system", blocks: [c[2].blocks[1]], task: sc(c[2].blocks[3]) }]}
    ],
    "les-wealth": c => [
      { name: "Foundations — the stock", kind: "foundations",
        src: { ref: "Ch. 11, p. 244 — 'The Sources of Wealth'",
          data: ["Net worth = non-financial + financial assets − liabilities; stock vs flow — p. 244"] },
        steps: [
          { h: "Stock, not flow", blocks: bb(c[0], 0, 1),
            task: { type: "calc", q: "A household holds $1,120,000 in assets and owes $310,000. Net worth ($)?",
              expected: 810000, tol: 0.5, working: "Net worth = assets − liabilities = $1,120,000 − $310,000 = $810,000." } },
          { h: "The equation in words", blocks: [c[0].blocks[2]], task: ck(c[0]) }]},
      { name: "Evidence — the national balance sheet", kind: "evidence2",
        src: { ref: "Ch. 11, p. 244 — Table 11.2",
          data: ["Assets $12,356b · liabilities $2,038b · net worth $10,318b ≈ 5× GDP — p. 244",
                 "Property 56.2%, super 18.6%, deposits 6.6%, contents 6.1%, businesses 5.2%, shares 5.1%, vehicles 2.2% — Table 11.2"],
          fig: "Interactive presentation of Table 11.2 — segment values table-exact; the tappable bar is our rendering." },
        steps: [
          { h: "Tap the balance sheet", blocks: bb(c[1], 0, 1, 2), task: ck(c[1]) },
          { h: "The loop", blocks: [c[2].blocks[1]], task: ck(c[2]) }]},
      { name: "Skills — work the balance sheet", kind: "skills",
        src: { ref: "Ch. 11, pp. 244 & 247 — Tables 11.2 & 11.4 values",
          data: ["Mean assets $1,245,800; mean net worth $1,042,000 — p. 244", "Top quintile $3,267,100; bottom $35,100 — Table 11.4"] },
        steps: [
          { h: "Mean liabilities", blocks: [],
            task: { type: "calc", q: "Mean household assets were $1,245,800 and mean net worth $1,042,000. Mean liabilities ($)?",
              expected: 203800, tol: 0.5, working: "$1,245,800 − $1,042,000 = $203,800 of liabilities per household." } },
          { h: "Top to bottom", blocks: [ref("Open the income-vs-wealth comparison", "incomeVsWealth")],
            task: { type: "calc", q: "Average net worth: top quintile $3,267,100, bottom quintile $35,100 (Table 11.4). Ratio, nearest whole number?",
              expected: 93, tol: 1, working: "$3,267,100 ÷ $35,100 ≈ 93 — the top quintile's average is about 93 times the bottom's." } }]},
      { name: "Economist — explain the divergence", kind: "economist",
        src: { ref: "Ch. 11, p. 247 — Table 11.4 and the life-cycle explanation",
          data: ["Ginis 0.611 / 0.436 / 0.324 — Table 11.4", "Life-cycle accumulation and drawdown — p. 247"] },
        steps: [
          { h: "The saving loop, in writing", blocks: [c[2].blocks[3]],
            task: { type: "short", q: "Use the saving loop to explain why wealth inequality (0.611) is nearly double income inequality (0.324).",
              vocab: [{ t: "sav", d: "saving" }, { t: "asset", d: "assets" }, { t: "unearned", d: "unearned income" }, { t: "compound", d: "compounding" }],
              model: "High earners save more; savings become assets; assets yield unearned income that funds further accumulation — a loop low earners cannot start. The stock compounds across lifetimes and generations while income is re-equalised annually by tax and transfers, so wealth ends up nearly twice as unequal." } },
          { h: "Life cycle or class?", blocks: [c[2].blocks[4]],
            task: { type: "short", q: "A politician claims wealth inequality statistics are 'just the life cycle'. Evaluate the claim in two sentences.",
              vocab: [{ t: "life cycle", d: "life cycle" }, { t: "retir", d: "retirees" }, { t: "93", d: "the 93:1 ratio" }, { t: "persist", d: "persists within age groups" }],
              model: "The life cycle explains part of the pattern — retirees pair high net worth with low current income — but it cannot explain a 93:1 gap between top and bottom quintile averages or a Gini of 0.611. Concentration also reflects the saving loop and intergenerational transfer, which persist within every age band." } }]}
    ],
    "les-patterns": c => [
      { name: "Foundations — typical vs average", kind: "foundations",
        src: { ref: "Ch. 11, pp. 245–246 — mean vs median",
          data: ["Mean $1,124 vs median $959 (2019–20); mean +2.7% from $1,094; ~75% of households with mortgage debt — pp. 245–246"] },
        steps: [
          { h: "Two numbers, two stories", blocks: bb(c[0], 0, 1), task: ck(c[0]) },
          { h: "Why the gap exists", blocks: [c[0].blocks[2]],
            task: { type: "short", q: "Why do analysts prefer the median to the mean for tracking typical living standards? Two sentences.",
              vocab: [{ t: "skew", d: "right-skew" }, { t: "tail", d: "upper tail" }, { t: "median", d: "median" }, { t: "middle", d: "middle household" }],
              model: "The income distribution is right-skewed: a long upper tail drags the mean above most households' experience. The median marks the middle household regardless of extremes, so it tracks typical living standards while the mean tracks the tail." } }]},
      { name: "Evidence — the dimensions", kind: "evidence2",
        src: { ref: "Ch. 11, pp. 248–249 — 'Dimensions in the Distribution'; Table 11.5",
          data: ["AWE: males $2,074 vs females $1,814 (2024) — ABS Cat. 6306.0", "Occupation $785–$2,712; age peak 35–54 — p. 248",
                 "Lone persons 41.4% / one-parent 37.7% in lowest quintile; couples without children 28.4% in highest — Table 11.5"] },
        steps: [
          { h: "Walk the dimensions", blocks: bb(c[1], 0, 1, 2), task: ck(c[1]) },
          { h: "The life cycle", blocks: [c[2].blocks[1]], task: ck(c[2]) }]},
      { name: "Skills — quantify the gaps", kind: "skills",
        src: { ref: "Ch. 11, pp. 246 & 248 — the values behind the dimensions",
          data: ["Mean $1,124 / median $959 — p. 246", "Male AWE $2,074 / female $1,814 — p. 248"] },
        steps: [
          { h: "Quantify the skew", blocks: [],
            task: { type: "calc", q: "Mean weekly income $1,124, median $959. By what percentage does the mean exceed the median? (1 dp)",
              expected: 17.2, tol: 0.1, working: "($1,124 − $959) ÷ $959 ≈ 17.2% — the mean runs about a sixth above the typical household." } },
          { h: "Quantify the gender gap", blocks: [],
            task: { type: "calc", q: "Male AWE $2,074; female AWE $1,814. The gap as a percentage of male earnings? (1 dp)",
              expected: 12.5, tol: 0.1, working: "($2,074 − $1,814) ÷ $2,074 ≈ 12.5% of male average weekly earnings." } }]},
      { name: "Economist — read positions, not just incomes", kind: "economist",
        src: { ref: "Ch. 11, pp. 246–247 & 249 — life cycle; Figure 11.4's subtlety",
          data: ["Lone-parent Gini 0.307 vs population 0.333 — Figure 11.4 / p. 246", "Wealth accumulated over the working life, drawn down in retirement — pp. 247, 249"] },
        steps: [
          { h: "Same income, different lives", blocks: [], task: sc(c[2].blocks[2]) },
          { h: "The homogeneity subtlety", blocks: [c[2].blocks[3]],
            task: { type: "short", q: "Lone-parent households are poorer on average, yet their internal Gini (0.307) is lower than the population's (0.333). Explain in two sentences.",
              vocab: [{ t: "homogen", d: "homogeneous" }, { t: "within", d: "within-group" }, { t: "similar", d: "similar incomes" }, { t: "group", d: "sub-population" }],
              model: "Sub-populations are more homogeneous than the whole population: lone-parent households cluster in a narrow income band, so inequality within the group is low even though the group sits low. A group can be equal and poor at once — within-group and between-group inequality are different things." } }]}
    ],
    "les-debate": c => [
      { name: "Foundations — the efficiency case", kind: "foundations",
        src: { ref: "Ch. 11, pp. 249–250 — benefits of inequality",
          data: ["Incentive effect; wage flexibility and mobility; saving → investment; 'growth dividend' — pp. 249–250",
                 "Wages 55.8% vs capital 29.2% of GDP, 2021–22 — p. 250"] },
        steps: [
          { h: "The incentive chain", blocks: bb(c[0], 0, 1, 2), task: ck(c[0]) }]},
      { name: "Evidence — the costs", kind: "evidence2",
        src: { ref: "Ch. 11, p. 250 — economic and social costs",
          data: ["Keynes (1936): deficient aggregate demand — p. 250", "Gregory (1993) 'working poor'; relative poverty as the major social cost — p. 250"] },
        steps: [
          { h: "Keynes's mechanism", blocks: bb(c[1], 0, 1), task: ck(c[1]) },
          { h: "Fiscal and social costs", blocks: [c[1].blocks[2]],
            task: { type: "short", q: "Name one fiscal and one social cost of high inequality — a sentence each.",
              vocab: [{ t: "budget", d: "budget/welfare spending" }, { t: "welfare", d: "welfare" }, { t: "poverty", d: "relative poverty" }, { t: "divi", d: "social division" }],
              model: "Fiscal: greater inequality drives higher welfare spending and a weaker budget balance through larger deficits or smaller surpluses. Social: relative poverty and the alienation of marginalised groups divide the community along income lines — Gregory's 'working poor' is the standing example." } }]},
      { name: "Skills — compute the trap", kind: "skills",
        src: { ref: "Ch. 11, p. 250 — EMTRs and poverty traps",
          data: ["EMTR = benefit withdrawal + marginal tax + lost concessions — p. 250"] },
        steps: [
          { h: "Compute the keep", blocks: [c[2].blocks[1]],
            task: { type: "calc", q: "An extra shift pays $100. The payment tapers at 50c per dollar and the marginal tax rate is 16%. Dollars kept?",
              expected: 34, tol: 0.5, working: "$100 − $50 withdrawn − $16 tax = $34 kept." } },
          { h: "Compute the EMTR", blocks: [],
            task: { type: "calc", q: "What effective marginal tax rate (%) does that imply?",
              expected: 66, tol: 0.5, working: "$66 of the $100 is lost (50 taper + 16 tax) — an EMTR of 66%." } }]},
      { name: "Economist — design and trade-offs", kind: "economist",
        src: { ref: "Ch. 11, p. 250 — poverty traps and the 2000–2024 policy response",
          data: ["MTR cuts, threshold rises, welfare reform strengthening work incentives — p. 250"] },
        steps: [
          { h: "Design a fix, see the trade-off", blocks: [],
            task: { type: "short", q: "A minister proposes cutting the benefit taper from 50c to 30c per dollar. Predict the effect on the poverty trap and identify one trade-off — two sentences.",
              vocab: [{ t: "emtr", d: "EMTR" }, { t: "incentive", d: "work incentive" }, { t: "cost", d: "fiscal cost" }, { t: "taper", d: "taper" }],
              model: "A 30c taper cuts the EMTR from 66% to 46%, so each extra dollar keeps 54c instead of 34c — strengthening the incentive to work. The trade-off is fiscal: payments now extend further up the income scale, raising budget cost." } },
          { h: "The trap in one move", blocks: [c[2].blocks[3]], task: ck(c[2]) }]}
    ],
    "les-policy": c => [
      { name: "Foundations — the progressive engine", kind: "foundations",
        src: { ref: "Ch. 11, pp. 243 & 251 — rates, thresholds, Table 11.6",
          data: ["2024–25 scale: 0 / 16 / 30 / 37 / 45% at $18,200 / $45k / $135k / $190k — p. 243, Table 11.6",
                 "Stage Three changes; bracket creep and the 2012–13, 2020, 2024 reforms — p. 251"],
          fig: "Calculator built on Table 11.6's rates — it computes with the table's values rather than depicting them." },
        steps: [
          { h: "The progressive engine", blocks: bb(c[0], 0, 1), task: ck(c[0]) },
          { h: "Reform and creep", blocks: bb(c[0], 2, 3),
            task: { type: "short", q: "What is bracket creep, and why does it require periodic threshold reform? Two sentences.",
              vocab: [{ t: "threshold", d: "thresholds" }, { t: "nominal", d: "nominal wage growth" }, { t: "average", d: "average rate" }, { t: "real", d: "no real gain" }],
              model: "With thresholds fixed in dollars, nominal wage growth drags earners into higher brackets and raises average tax rates with no real income gain. Periodic threshold rises — 2012–13, 2020 and 2024 — hand the accumulated creep back." } }]},
      { name: "Evidence — three pillars", kind: "evidence2",
        src: { ref: "Ch. 11, pp. 251–253 — Table 11.7; the wage floor; the social wage",
          data: ["$290.9b ≈ 37% of budget; aged $109.5b / disability $90.9b / families $52.5b — Table 11.7",
                 "NMW +3.5% ($32.10) to $948 from July 2025; Fair Work Act 2009 NES & BOOT — p. 253"] },
        steps: [
          { h: "Transfers, the floor, the social wage", blocks: bb(c[1], 0, 1, 2), task: ck(c[1]) }]},
      { name: "Skills — tax a real income", kind: "skills",
        src: { ref: "Ch. 11, Table 11.6 (p. 251) — the rates used in both tasks",
          data: ["16% to $45,000; 30% to $135,000 — Table 11.6"] },
        steps: [
          { h: "Tax a $90,000 income", blocks: [ref("Open the tax calculator", "taxCalc", "int")],
            task: { type: "calc", q: "Using the 2024–25 scale, calculate total tax on a taxable income of $90,000.",
              expected: 17788, tol: 1, working: "16% × $26,800 = $4,288; 30% × $45,000 = $13,500; total $17,788." } },
          { h: "Average vs marginal", blocks: [],
            task: { type: "calc", q: "What average tax rate does that imply? (%, 1 dp)",
              expected: 19.8, tol: 0.1, working: "$17,788 ÷ $90,000 ≈ 19.8% — far below the 30% marginal rate, which is the whole point of a progressive scale." } }]},
      { name: "Economist — the assessment", kind: "economist",
        src: { ref: "Ch. 11, pp. 247 & 251–253 — effectiveness evidence and limits",
          data: ["Gini 0.436 (gross) → 0.324 (disposable); wealth 0.611 — Table 11.4",
                 "COVID and GFC responses; Intergenerational Reports, NDIS +$13.2b, aged care $17.7b — pp. 252–253"] },
        steps: [
          { h: "The verdict, with evidence", blocks: [c[2].blocks[1], c[2].blocks[2]], task: sc(c[2].blocks[3]) },
          { h: "Write the assessment", blocks: [c[2].blocks[4]],
            task: { type: "short", q: "Assess in two sentences: 'Australia redistributes income effectively but wealth barely at all.'",
              vocab: [{ t: "0.436", d: "0.436 gross" }, { t: "0.324", d: "0.324 disposable" }, { t: "0.611", d: "0.611 wealth" }, { t: "wealth tax", d: "no wealth tax" }],
              model: "On income the claim holds: the Gini falls from 0.436 gross to 0.324 disposable every year through progressive taxation and targeted transfers. On wealth it also holds — Australia levies no death duties, inheritance tax or general wealth tax, and the net-worth Gini remains 0.611, nearly double income." } }]}
    ]
  };
  window.CONTENT.areas.forEach(a => (a.lessons || []).forEach(l => {
    if (build[l.id]) l.levels = build[l.id](l.chunks);
  }));
})();

// -----------------------------------------------------------------------------
// PEDAGOGY PASS: every step opens with an explicit Concept line; no step leads
// with an unexplained graphic; carried-over leads rewritten; each level carries
// the source page for the teacher-configured textbook deep link.
// All wording original.
// -----------------------------------------------------------------------------
(function () {
  const CONCEPTS = {
    "les-measuring": [
      ["A household's position is measured by equivalised disposable income — income after tax, adjusted for household size and composition.",
       "Quintiles split the ranked population into five equal 20% groups; their income shares reveal the shape of inequality."],
      ["The Lorenz curve plots cumulative population share against cumulative income share — distance from the diagonal IS the inequality.",
       "Every Lorenz curve shares four properties, and shifts toward or away from the diagonal read as falling or rising inequality."],
      ["The Gini coefficient moves toward 1 as inequality rises and toward 0 as it falls.",
       "Gini = Area A ÷ (Area A + Area B) — a ratio of areas on the diagram, nothing more mysterious.",
       "Cumulative shares are built by adding quintiles from the bottom up — each sum is a point on the Lorenz curve.",
       "Comparing a group's wealth share with its income share quantifies how much more concentrated wealth is."],
      ["One instrument, two distributions: the gap between 0.324 and 0.611 is itself the finding.",
       "Level and spread are independent: typical incomes can rise while inequality also rises."]],
    "les-income": [
      ["Income is a flow, and each factor of production earns its own distinct return.",
       "Earned income rewards labour; unearned income rewards ownership — and ownership is concentrated."],
      ["Wages dominate household income, so what happens to wages steers the whole distribution.",
       "The national accounts' categories are the metalanguage of this topic — use them and examiners notice."],
      ["A percentage share becomes meaningful when you convert it into dollars.",
       "Over half of everything households receive is compensation of employees.",
       "Transfers are income without a corresponding contribution to current production — that's their definition."],
      ["Factor shares move slowly — but their drift compounds into the inequality trend.",
       "The tax-transfer system has three coordinated elements, each reaching a different kind of need."]],
    "les-wealth": [
      ["Net worth = total assets − total liabilities, valued at a point in time. That's the whole definition.",
       "Stock and flow answer different questions about the same household — never let an essay blur them."],
      ["Property dominates Australian household wealth, so dwelling prices drive wealth inequality.",
       "Saving converts the income flow into the wealth stock — the loop that chains the two distributions together."],
      ["Balance-sheet identities let you recover any missing term from the other two.",
       "Ratios make concentration concrete: a top-to-bottom multiple says more than two percentages."],
      ["The saving loop plus annual income re-equalisation explains why the stock is twice as unequal as the flow.",
       "Life-cycle effects explain part of wealth inequality — but only part, and an economist says which part."]],
    "les-patterns": [
      ["Mean above median is the fingerprint of a right-skewed distribution.",
       "The median resists extreme values; the mean chases them."],
      ["Income differs systematically by gender, occupation, age and background — and the gaps overlap.",
       "Households move through a life cycle, and their income capacity moves with them."],
      ["The skew can be quantified: the mean's excess over the median, expressed as a percentage.",
       "Gaps are reported as a percentage of the higher figure so different gaps can be compared."],
      ["Equal incomes can hide unequal positions once wealth and housing costs enter the picture.",
       "Within-group and between-group inequality are different measurements — a group can be equal and poor at once."]],
    "les-debate": [
      ["The efficiency case: differential rewards are claimed to drive effort, mobility, risk-taking and growth."],
      ["Concentrating income where saving is highest weakens aggregate demand — Keynes's mechanism.",
       "Inequality's costs are fiscal and social as well as macroeconomic — strong essays name all three."],
      ["An effective marginal tax rate stacks benefit withdrawal on top of marginal tax.",
       "The effective rate is what's lost from the NEXT dollar — not the headline tax rate."],
      ["Every redistribution design buys an incentive effect with a fiscal cost — the trade-off never disappears.",
       "Poverty traps are produced by interaction between systems, not by any single policy."]],
    "les-policy": [
      ["Progressive means each successive slice faces a higher rate — so the average rate always sits below the marginal.",
       "Bracket creep raises average tax rates silently; threshold reform is the antidote."],
      ["Transfers, the wage floor and the social wage redistribute through three different channels."],
      ["Tax is computed slice by slice — never the whole income at one rate.",
       "The average rate summarises the whole scale's bite on one income."],
      ["Effectiveness is an evidence question: compare the Ginis before and after redistribution.",
       "A defensible assessment names what works, what doesn't, and the standing limits."]]
  };
  const PAGES = {
    "les-measuring": [245, 241, 241, 247], "les-income": [242, 242, 242, 243],
    "les-wealth": [244, 244, 247, 247], "les-patterns": [246, 248, 246, 246],
    "les-debate": [249, 250, 250, 250], "les-policy": [243, 252, 251, 247]
  };
  const LEADS = {
    "les-measuring": "Inequality can't be debated until it's measured — and the ABS makes deliberate choices before a single number is published. Each choice changes what the data can honestly say.",
    "les-income": "Every dollar a household receives has a source, and which source dominates decides how the whole distribution moves. Start by naming the four factor returns precisely.",
    "les-wealth": "Income is what flows in this year; wealth is what has accumulated by today. Keeping the stock and the flow separate is the first discipline of this topic.",
    "les-patterns": "Two summary numbers — the mean and the median — tell two different stories about the same households. Knowing which to trust, and when, is a skill examiners test directly.",
    "les-debate": "Economists disagree about inequality for structured reasons, not taste. The strongest essays state the efficiency case fairly before judging it.",
    "les-policy": "Redistribution is engineered, not wished for: a progressive tax scale on one side, transfers and services on the other. Start with how the tax engine actually computes."
  };
  const INTROS = { // explanatory text unshifted before graphic-first steps: lessonId → { "li-si": text }
    "les-measuring": {
      "0-1": "Below, Table 11.3 becomes an experiment: $100 of national income, split exactly the way Australia splits it. Reveal each quintile in turn, watch the running total — then read the two figures beneath the bars.",
      "2-2": "Reopen the split if you need the shares in front of you — then build the cumulative figure you would plot on a Lorenz curve." },
    "les-income": { "2-0": "The pie shows the shares; this task converts one share into dollars. Open the figure if you want the picture beside the arithmetic." },
    "les-wealth": { "2-1": "The comparison chart is one tap away if you want to see the gap you're about to quantify." },
    "les-policy": { "2-0": "Do the slices by hand first — that's what the exam requires. The calculator is there to check your method afterwards." }
  };
  window.CONTENT.areas.forEach(a => (a.lessons || []).forEach(l => {
    const cs = CONCEPTS[l.id], pages = PAGES[l.id];
    if (!l.levels || !cs) return;
    l.levels.forEach((L, li) => {
      if (pages && pages[li]) L.src.page = pages[li];
      L.steps.forEach((s, si) => {
        if (cs[li] && cs[li][si]) s.concept = cs[li][si];
        const intro = (INTROS[l.id] || {})[li + "-" + si];
        if (intro) s.blocks = [{ t: "p", x: intro }].concat(s.blocks || []);
      });
    });
    // rewritten opening lead (replaces the carried-over one in level 1, step 1)
    if (LEADS[l.id] && l.levels[0] && l.levels[0].steps[0]) {
      const b0 = l.levels[0].steps[0].blocks;
      if (b0 && b0.length && b0[0].t === "lead") b0[0] = { t: "lead", x: LEADS[l.id] };
    }
  }));
})();

// -----------------------------------------------------------------------------
// INSTRUCTIONAL REVISION: rewrite the building reveals so each step leads with
// a plain, concrete idea and names the technical term only afterwards. Stylised
// constructions removed. Sophistication is retained at the Economist level,
// once understanding has been built. All wording original.
// -----------------------------------------------------------------------------
(function () {
  const R = {
    "Build the measure": [
      { label: "Begin with everything that comes in", text: "Add up everything a household receives in a year — pay, profits, rent, interest, dividends, and any government payments. That total is its gross income." },
      { label: "Take out income tax", text: "A household can't spend what it pays in tax, so subtract income tax from the total. What's left — the money actually available to spend or save — is its disposable income." },
      { label: "Adjust for how many people it supports", text: "$1,000 a week is comfortable for one person but stretches thinly across a family of five. So before any two households are compared, each one's income is scaled to a common household size. That size-adjusted figure is what economists call equivalised income, and it is the measure used for every figure in this topic." }],
    "The curve's four properties": [
      { label: "It starts at zero", text: "The poorest 0% of people hold 0% of income, so the line always begins in the bottom-left corner." },
      { label: "It ends at the top", text: "Once everyone is counted, 100% of people hold 100% of income — so the line always ends in the top-right corner. Both ends are fixed for every country." },
      { label: "A straight diagonal would mean total equality", text: "If income were shared perfectly evenly, the poorest 60% would hold exactly 60% of it, and so on — tracing a straight 45° line. Point C marks that idea: 60% of people, 60% of income." },
      { label: "Real curves sag below it", text: "Because income isn't shared evenly, the real line bends below the diagonal. The bigger the sag, the more unequal — and if the curve moves toward the diagonal over time, inequality is falling." }],
    "The four factor returns": [
      { label: "Land earns rent", text: "Own land or property and let others use it, and the payment you receive is rent." },
      { label: "Labour earns wages", text: "Work for someone and you're paid a wage or salary. This is the only one of the four that rewards effort — the other three reward owning something." },
      { label: "Capital earns interest", text: "Lend money, or hold it in financial assets, and the return is interest." },
      { label: "Enterprise earns profit", text: "Start and run a business, carrying the risk that it might fail, and the reward is profit." }],
    "The three elements": [
      { label: "Tax that rises with income", text: "The more you earn, the higher the rate on your top dollars — nothing on the first $18,200, then rates climbing from 16% up to 45%. Higher earners hand back a larger share. This is what 'progressive' taxation means." },
      { label: "Cash paid to those who need it", text: "Government pays some of that revenue back out — pensions, JobSeeker, family and disability support — to households with little income of their own. These are transfer payments, and income and assets tests keep them aimed at genuine need." },
      { label: "Help given as services, not cash", text: "Some support arrives not as money but as services: Medicare, public schools, subsidised housing and transport. This is the social wage — it lifts living standards without ever appearing in a pay packet." }],
    "Build the balance sheet": [
      { label: "Add up what you own that you can touch", text: "First the physical things: the home, any investment property or land, plus cars and household contents. These are real assets." },
      { label: "Add what you own on paper", text: "Next the financial things: money in the bank, shares, and superannuation. These are financial assets." },
      { label: "Subtract what you owe", text: "Finally, take off the debts — the mortgage and any personal loans. What remains is net worth: a single number for how wealthy a household really is." }],
    "Trace the loop": [
      { label: "High earners can save more", text: "Someone on a high income can put a large slice of it aside; someone on a low income spends almost all of theirs just getting by." },
      { label: "Savings turn into assets", text: "Money saved gets put into property, shares and super — it becomes wealth." },
      { label: "Assets pay you for owning them", text: "Those assets then earn income of their own — rent, interest, dividends and profit. You earn simply by owning them." },
      { label: "And that income buys still more assets", text: "The extra income funds more saving and more assets — a loop that feeds itself, and one a low earner can never start. Wealth also builds across a lifetime and passes to the next generation, while income is re-levelled by tax every year. That is why wealth ends up far more concentrated than income." }],
    "Why the gap exists": [
      { label: "A few very high incomes pull the average up", text: "Picture most households bunched together, with a handful earning enormous amounts. Those few drag the average upward, away from where most people actually sit." },
      { label: "The middle value doesn't move", text: "The median is simply the household in the exact middle — it doesn't care how large the top incomes grow. That's why it describes the typical household better than the average does." },
      { label: "And the growth wasn't shared evenly", text: "Between 2017–18 and 2019–20, middle-income households gained about 4%, while those at the top and bottom gained only around 1.2% each." }],
    "Follow a household through": [
      { label: "Starting out", text: "Young households usually earn moderately and own little, and many are renting." },
      { label: "Peak earning years, 35 to 54", text: "Earnings are highest here — which is when most households pay down a mortgage and build up superannuation." },
      { label: "Retirement", text: "Income drops, but the wealth built over a working life remains, and is slowly spent down. The result is low income and high wealth at the same time." }],
    "The incentive chain": [
      { label: "Bigger rewards encourage effort", text: "If skilled or harder work pays noticeably more, people are more willing to train, study and put in the hours. The pay gap is the incentive." },
      { label: "Pay differences move workers where they're needed", text: "When in-demand jobs pay more, workers shift toward them — so the economy puts labour where it is most valued." },
      { label: "Profit rewards risk", text: "People start businesses, which can fail, because success pays off. Remove the reward and fewer take the risk." },
      { label: "Higher incomes fund investment and growth", text: "High earners save more, and that saving funds investment in new capital and technology, which grows the economy. A growing economy then raises the tax revenue that pays for welfare. Supporters call this the growth dividend." }],
    "Keynes's mechanism, step by step": [
      { label: "Poorer households spend almost everything", text: "Give a low-income household an extra $100 and nearly all of it is spent; give it to a high-income household and much of it is saved. Economists call the share that gets spent the marginal propensity to consume — and it is higher for the poor." },
      { label: "So concentration at the top cuts spending", text: "If income piles up where more of it is saved rather than spent, the economy's total consumption falls below what a more even spread would produce." },
      { label: "Weak spending means weak demand", text: "Keynes (1936) drew the conclusion: too much inequality drags down aggregate demand, so redistributing toward lower incomes isn't only fairer — it can also support the economy." }],
    "Assemble an EMTR": [
      { label: "Earn one more dollar", text: "Suppose someone on welfare picks up extra work and earns one more dollar." },
      { label: "Tax takes a slice", text: "First, income tax applies — say 16 cents of that dollar." },
      { label: "And the payment shrinks", text: "At the same time, their income-tested payment is cut back — often by about 50 cents for every dollar earned — and concessions like rent assistance can fall away too." },
      { label: "Together, that's the trap", text: "Add it up: 16 cents of tax plus 50 cents of lost payment means they keep only about a third of what they earned. This combined bite is the effective marginal tax rate, and when it climbs this high it can trap people on welfare — sometimes across generations." }],
    "What changed, and why it matters": [
      { label: "The 2024 tax cuts", text: "From July 2024, the Stage Three changes cut the 19% rate to 16% and the 32.5% rate to 30%, and lifted the income thresholds where the higher rates begin." },
      { label: "Why thresholds need regular lifting", text: "Tax thresholds are set in dollars, so as wages rise with inflation people drift into higher brackets even when they are no better off in real terms. This silent rise is called bracket creep — and lifting the thresholds, as in 2012–13, 2020 and 2024, gives it back." }],
    "The three pillars": [
      { label: "Targeted cash payments", text: "Pensions and allowances are means-tested — limited by your income and assets — so the money concentrates on those who genuinely need it." },
      { label: "A floor under wages", text: "No worker can be paid below the National Minimum Wage, lifted 3.5% to $948 a week from July 2025 to protect the low-paid after high inflation. It sits inside the Fair Work Act's awards and its Better Off Overall Test." },
      { label: "Services for everyone", text: "Medicare, public schools, housing and transport are provided or subsidised directly. This is the social wage — it raises living standards in kind rather than in cash." }],
    "Stress tests: crisis capability": [
      { label: "COVID, 2020", text: "When the pandemic hit, the system scaled up within weeks: $750 payments to welfare recipients, a $550 coronavirus supplement, and JobKeeper at $1,500 a fortnight for each kept-on worker." },
      { label: "The global financial crisis, 2008–09", text: "Earlier, cash payments under the Economic Security Strategy and a $30b Nation Building program propped up spending through the downturn." }],
    "Read the trend like an economist": [
      { label: "Across the period, inequality eased", text: "The income Gini fell from 0.333 in 2013–14 to 0.324 by 2019–20 — a small but real decline, credited mainly to a stronger, better-targeted welfare system." },
      { label: "But not in a straight line", text: "Inside that fall, it rose between 2015–16 and 2017–18 (0.323 to 0.328), most likely because high-income households gained more from rising unearned income before the trend turned back." },
      { label: "The same tool exposes wealth", text: "Apply the identical measure to net worth and it reads 0.611 — one instrument showing how much less equal wealth is than income." }],
    "Walk the dimensions": [
      { label: "By gender", text: "Men's average weekly earnings were $2,074 in 2024 against $1,814 for women — and the gap holds even within the same occupations." },
      { label: "By occupation", text: "Managers and professionals averaged $1,954–$2,712 a week; sales, clerical and administrative workers averaged $785–$1,238." },
      { label: "By age", text: "Earnings peak between 35 and 54 ($2,396 for adult men, $1,991 for adult women) and are lower for 21–34 year-olds ($1,734) — the life cycle showing up across the population at once." },
      { label: "By background", text: "Migrants from English-speaking countries out-earn more recent arrivals, longer residency lifts income, and Indigenous Australians remain among the lowest earners — while casual or part-time work compounds every other gap." }]
  };
  window.CONTENT.areas.forEach(a => (a.lessons || []).forEach(l => {
    (l.chunks || []).forEach(ch => (ch.blocks || []).forEach(b => {
      if (b.t === "reveal" && R[b.cta]) b.steps = R[b.cta];
    }));
  }));
})();

// =============================================================================
// reviewSample — the canonical example of the long-response review contract
// (see review-model.md and proxy/worker.js submit_review). Ported verbatim from
// the design prototype (the tax-transfer example) into the exact shape the
// worker now returns. ILLUSTRATIVE ONLY: real reviews come from the worker. Used
// by review mode as the dev/eyeball fixture and as the executable contract.
// Only paragraph 2 is detailed (exactly as the prototype authored it); the other
// paragraphs carry their rail metadata. The real worker details them all.
// Marks are internally consistent: paragraph scores 3+3+2+5 = 13/20, and the
// rubric 5+3+2+3 = 13/20 (the honest-marking invariant, see review-model.md §4).
// =============================================================================
window.CONTENT.reviewSample = {
  question: { stem: "Evaluate the effectiveness of the tax-transfer system", command: "Evaluate", marks: 20 },
  total: 13, max: 20,
  summary: "A clear, sustained judgement backed by good income data, but the wealth side is thinly evidenced and a few lines overstate or slip into everyday wording.",
  paragraphs: [
    { name: "Introduction", score: 3, max: 3, reasons: [], sentences: [] },
    {
      name: "Income redistribution", score: 3, max: 6,
      reasons: [
        { kind: "good", text: "Clear point, backed by precise figures (0.436 to 0.324)." },
        { kind: "weak", text: "The figures aren't named as gross vs disposable, so they float." },
        { kind: "weak", text: "Overstated and vague wording (“proves”, “works”)." },
        { kind: "weak", text: "No economic terminology, and a colloquial closing line." },
        { kind: "weak", text: "Doesn't link forward to the wealth paragraph." }
      ],
      sentences: [
        {
          text: "The tax-transfer system reduces income inequality, the Gini falling from 0.436 to 0.324.",
          issues: [
            {
              kind: "fix", severity: "critical", head: "Say which Ginis these are",
              why: "The fall only counts as evidence if you name them as the {{gross income Gini|The Gini of income before tax and government transfers are applied.|247}} and {{disposable income Gini|The Gini of income after income tax and transfers, the measure of what households actually keep.|247}}, the before and after measures. Without that, the reader can't see what the numbers prove.",
              ladder: [
                { level: "Clear", text: "The disposable-income Gini falls from 0.436 to 0.324 once tax and transfers apply.", starters: ["The disposable-income Gini falls from 0.436 to 0.324 once <b>____________</b> apply.", "The disposable-income Gini falls from <b>____________</b> once tax and transfers apply.", "____________"] },
                { level: "Better", text: "Comparing the gross Gini of 0.436 with the disposable Gini of 0.324 shows the system's redistributive effect.", starters: ["Comparing the gross Gini of 0.436 with the disposable Gini of 0.324 shows the system's <b>____________</b> effect.", "Comparing the gross Gini of 0.436 with the disposable Gini of <b>____________</b> shows the system's redistributive effect.", "____________"] },
                { level: "Band 6", text: "The income Gini falls from 0.436 before tax and transfers to 0.324 after them, a direct measure of how much the system compresses the distribution.", starters: ["The income Gini falls from 0.436 before tax and transfers to 0.324 after them, a direct measure of how much the system <b>____________</b> the distribution.", "The income Gini falls from 0.436 before tax and transfers to 0.324 after them, a direct measure of <b>____________</b>.", "____________"] }
              ]
            }
          ]
        },
        {
          text: "This proves the system works.",
          issues: [
            {
              kind: "fix", severity: "should", head: "“Proves” is too strong",
              why: "One statistic supports a claim, it doesn't prove it. A measured verb reads at a higher band.",
              ladder: [
                { level: "Clear", text: "This shows the system substantially reduces income inequality.", starters: ["This shows the system substantially reduces <b>____________</b>.", "This shows the system substantially <b>____________</b> income inequality.", "____________"] },
                { level: "Better", text: "This substantially compresses the income distribution, the system's central aim.", starters: ["This substantially compresses the income distribution, the system's central <b>____________</b>.", "This substantially <b>____________</b> the income distribution, the system's central aim.", "____________"] },
                { level: "Band 6", text: "This demonstrates a substantial compression of the income distribution, the system's central redistributive aim.", starters: ["This demonstrates a substantial compression of the income distribution, the system's central <b>____________</b> aim.", "This demonstrates a substantial <b>____________</b> of the income distribution.", "____________"] }
              ]
            },
            {
              kind: "fix", severity: "should", head: "“Works” is vague",
              why: "Works at what? Name the criterion, reducing income inequality, rather than giving a verdict with no measure.",
              ladder: [
                { level: "Clear", text: "It reduces the gap between high and low income earners.", starters: ["It reduces the gap between high and low income <b>____________</b>.", "It reduces the gap between <b>____________</b> income earners.", "____________"] },
                { level: "Better", text: "It narrows the gap between the highest and lowest income quintiles each year.", starters: ["It narrows the gap between the highest and lowest income <b>____________</b> each year.", "It narrows the gap between the highest and lowest income quintiles <b>____________</b>.", "____________"] },
                { level: "Band 6", text: "It narrows the gap between the top and bottom quintiles, the criterion on which redistributive effectiveness is judged.", starters: ["It narrows the gap between the top and bottom quintiles, the <b>____________</b> on which redistributive effectiveness is judged.", "It narrows the gap between the top and bottom quintiles, the criterion on which <b>____________</b> is judged.", "____________"] }
              ]
            }
          ]
        },
        {
          text: "Progressive tax and transfers do the work each year.",
          issues: [
            {
              kind: "fix", severity: "should", head: "This line is filler",
              why: "“Do the work” is colloquial, adds no new analysis and carries no data. Make it analytical, or cut it.",
              ladder: [
                { level: "Clear", text: "Progressive tax and means-tested transfers drive this reduction each year.", starters: ["Progressive tax and means-tested transfers drive this <b>____________</b> each year.", "Progressive tax and <b>____________</b> transfers drive this reduction each year.", "____________"] },
                { level: "Better", text: "Progressive taxation and means-tested transfers are the two mechanisms driving this annual reduction.", starters: ["Progressive taxation and means-tested transfers are the two <b>____________</b> driving this annual reduction.", "Progressive taxation and means-tested transfers are the two mechanisms driving this annual <b>____________</b>.", "____________"] },
                { level: "Band 6", text: "Progressive taxation and tightly means-tested transfers are the mechanisms behind this annual compression, redistributing roughly a third of revenue to lower earners.", starters: ["Progressive taxation and tightly means-tested transfers are the mechanisms behind this annual compression, redistributing roughly a third of <b>____________</b> to lower earners.", "Progressive taxation and tightly means-tested transfers are the mechanisms behind this annual <b>____________</b>.", "____________"] }
              ]
            },
            {
              kind: "term", severity: "optional", head: "Optional: add a key term",
              why: "You can lift the band by naming a relevant {{economic term|Subject-specific vocabulary that markers reward, e.g. vertical equity.|250}} here. This is optional, you can skip it.",
              ladder: [
                { level: "Clear", text: "This reflects vertical equity, since higher earners contribute a higher proportion.", starters: ["This reflects <b>____________</b>, since higher earners contribute a higher proportion.", "This reflects vertical equity, since higher earners contribute a higher <b>____________</b>.", "____________"] },
                { level: "Better", text: "This reflects vertical equity, as those who earn more contribute proportionally more.", starters: ["This reflects <b>____________</b>, as those who earn more contribute proportionally more.", "This reflects vertical equity, as those who earn more contribute <b>____________</b>.", "____________"] },
                { level: "Band 6", text: "This embodies vertical equity, since proportionally higher contributions from high earners fund the transfers that compress the distribution.", starters: ["This embodies <b>____________</b>, since proportionally higher contributions from high earners fund the transfers that compress the distribution.", "This embodies vertical equity, since proportionally higher contributions from high earners fund the transfers that <b>____________</b>.", "____________"] }
              ]
            }
          ]
        },
        {
          text: null, link: true, missing_label: "a sentence linking to the next paragraph",
          issues: [
            {
              kind: "fix", severity: "critical", head: "Add a sentence linking to ¶3",
              why: "Your paragraph ends on income, then the next paragraph starts cold on wealth. Add a bridge that turns from income to wealth so the argument flows.",
              ladder: [
                { level: "Clear", text: "However, this success on income does not extend to wealth.", starters: ["However, this success on income does not extend to <b>____________</b>.", "However, this success on income does not <b>____________</b> to wealth.", "____________"] },
                { level: "Better", text: "The same system that compresses income, however, leaves the far more unequal distribution of wealth largely untouched.", starters: ["The same system that compresses income, however, leaves the far more unequal distribution of <b>____________</b> largely untouched.", "The same system that compresses income, however, leaves the far more unequal distribution of wealth largely <b>____________</b>.", "____________"] },
                { level: "Band 6", text: "Yet the very mechanisms that compress income, progressive tax and transfers, barely reach wealth, which is why the wealth distribution remains close to twice as unequal.", starters: ["Yet the very mechanisms that compress income, progressive tax and transfers, barely reach wealth, which is why the wealth distribution remains close to <b>____________</b> as unequal.", "Yet the very mechanisms that compress income, progressive tax and transfers, barely reach <b>____________</b>.", "____________"] }
              ]
            }
          ]
        }
      ]
    },
    { name: "Wealth barely taxed", score: 2, max: 5, reasons: [], sentences: [] },
    { name: "Judgement", score: 5, max: 6, reasons: [], sentences: [] }
  ],
  rubric: [
    {
      name: "Thesis & sustained judgement", score: 5, max: 6, descriptor: "A clear position, held and developed across the response.",
      bands: [
        { range: "1-2", text: "No clear position; describes rather than judges.", here: false },
        { range: "3-4", text: "A position stated but not consistently developed.", here: false },
        { range: "5-6", text: "Clear, sustained judgement. Yours holds from intro to conclusion.", here: true }
      ]
    },
    {
      name: "Use of evidence & data", score: 3, max: 6, descriptor: "Accurate, relevant statistics that support the argument.",
      bands: [
        { range: "1-2", text: "Little or no data; assertions unsupported.", here: false },
        { range: "3-4", text: "Good data (the two Ginis), but one side, wealth, is thinly evidenced.", here: true },
        { range: "5-6", text: "Precise data on both income and wealth, fully integrated.", here: false }
      ]
    },
    {
      name: "Economic terminology", score: 2, max: 4, descriptor: "Correct use of the subject's metalanguage.",
      bands: [
        { range: "1", text: "Everyday language only.", here: false },
        { range: "2", text: "Some terms, but key ones (vertical equity, disposable income) missing.", here: true },
        { range: "3-4", text: "Fluent, accurate metalanguage throughout.", here: false }
      ]
    },
    {
      name: "Cohesion", score: 3, max: 4, descriptor: "Paragraphs connect into one argument.",
      bands: [
        { range: "1-2", text: "Disconnected points.", here: false },
        { range: "3", text: "Mostly linked; the income to wealth join is abrupt.", here: true },
        { range: "4", text: "Seamless: every paragraph hands to the next.", here: false }
      ]
    }
  ]
};
