// =============================================================================
// Marginal — essay practice content (HSC Ancient History, Year 11).
//
// ORIGINAL questions and scaffolding written for this app in the HSC genre.
// Nothing here is reproduced from NESA papers, marking guidelines or any
// textbook: published material informed the genre and topic spread only, it is
// never copied or lightly reworded into app content. Statistics or claims are
// avoided on purpose; this file carries questions and structure, not facts the
// app would have to vouch for. Coaching never supplies the argument or content.
//
// Loaded as window.ESSAY before app.js. Economics (window.CONTENT) is untouched.
// =============================================================================
window.ESSAY = {
  // Subjects keyed by the value the client subject map resolves a class code to.
  // Only ancient_history ships today; the shape is ready for more.
  subjects: {
    ancient_history: {
      key: "ancient_history",
      label: "Ancient History",
      stage: "Year 11",
      // Marked against THIS subject's dimensions, never another's. Original wording.
      markingCriteria: [
        "historical argument and judgement",
        "use of sources and evidence",
        "historical terms and concepts",
        "sustained and cohesive response"
      ],
      // Original practice questions in the HSC extended-response genre. Each is a
      // single, self-contained prompt a student picks from (or they paste their
      // own in setup). "command" is the HSC directive verb, surfaced as a chip.
      questions: [
        { id: "ah-sources",
          command: "Assess",
          text: "Assess the extent to which written and archaeological sources together shape our understanding of one ancient society you have studied.",
          topic: "Investigating ancient history: sources and evidence" },
        // --------------------------------------------------------------------
        // THE GENERIC QUESTION-DEFINITION SCHEMA, shown on this question and on
        // mkt-01 below. Everything here is content: no engine knows any subject.
        //
        //   id           stable slug, append-only. The join key for the argument
        //                pathways, concept explainers and evidence authored later.
        //   command      the HSC directive verb, surfaced as a chip and sent to
        //                the marker so it knows what kind of response is owed.
        //   text         the exact question the student sees and is marked against.
        //   marks        total marks. Drives the mark split in the review.
        //   topic        where in the course the question sits. Not a content claim.
        //   requirements what a response must DO. Claim-side by construction: it
        //                never states subject facts, so it stays content-free.
        //                  concepts       what has to be addressed
        //                  relationships  what has to be demonstrated, not just named
        //                  accomplish     what a strong response achieves
        //                  syllabus       the scope, in the syllabus's own terms
        //   criteria     { bands, source }. bands: null means fall through to the
        //                subject's, then to the general expectations above.
        //
        // Only id, command, text are required. Everything else is optional and the
        // marker simply has less to go on without it.
        // --------------------------------------------------------------------
        { id: "ah-religion",
          command: "Explain",
          text: "Explain how religious beliefs shaped everyday life in one ancient society you have studied.",
          marks: 20,
          topic: "Features of ancient societies: religion and belief",
          requirements: {
            concepts: ["religious belief", "religious practice and ritual", "everyday life", "social structure and roles", "the limits of the surviving evidence"],
            relationships: [
              "religious belief shapes daily practice, not only formal ceremony",
              "religious authority shapes social and family roles",
              "belief and material life influence each other, rather than one simply following the other"
            ],
            accomplish: [
              "holds one judgement about how far religious belief reached into ordinary life, rather than listing the areas it touched",
              "explains at least one area of everyday life deeply enough to show the mechanism, instead of covering several at surface level",
              "draws on more than one kind of source and says what each one proves",
              "separates what the sources show from what they leave unclear"
            ],
            syllabus: "Features of ancient societies: religion, belief and their place in daily life. The society is the student's own choice and is never named here."
          },
          criteria: { bands: null, source: "general HSC band expectations" } },
        { id: "ah-geography",
          command: "To what extent",
          text: "To what extent did geography shape the development of one ancient society you have studied?",
          topic: "Features of ancient societies: environment and economy" },
        { id: "ah-women",
          command: "Evaluate",
          text: "Evaluate the usefulness of the available sources for reconstructing the role of women in one ancient society you have studied.",
          topic: "Investigating ancient history: reliability and usefulness" },
        { id: "ah-power",
          command: "Discuss",
          text: "Discuss the relationship between political power and religious authority in one ancient society you have studied.",
          topic: "Features of ancient societies: power and authority" },
        { id: "ah-site",
          command: "Account for",
          text: "Account for the significance of one major site or monument to the society that built it.",
          topic: "Features of ancient societies: significant sites" }
      ]
    },

    // -------------------------------------------------------------------------
    // Business Studies (Year 12). Extended-response practice built around the
    // syllabus RELATIONSHIP the question tests (Term 1 affects Term 2), not just
    // the command verb. Each question carries: qtype (A relationship, B judgement,
    // C multi-element with mandatory targets), a topic tag, an exemplar paragraph
    // PLAN (four syllabus relationships, not "four paragraphs"), and the core
    // argument. Questions are original wording; FIN-01/FIN-02 mirror the 2024/2025
    // HSC finance relationships and are flagged as such. No case-study content is
    // asserted here: the student supplies the business evidence.
    // -------------------------------------------------------------------------
    business_studies: {
      key: "business_studies",
      label: "Business Studies",
      stage: "Year 12",
      // The business the verified evidence bank is built on. A level 5 example is
      // rejected in code if it mentions this, because an example in the student's
      // own context is a sentence to copy rather than a pattern to learn.
      caseStudy: "McDonald",
      // The four dimensions an HSC Business Studies extended response is assessed on,
      // described in original wording.
      markingCriteria: [
        "knowledge and understanding of course content",
        "application of business case studies and contemporary business issues",
        "business terminology and concepts",
        "sustained, logical and cohesive response"
      ],
      defaultStructure: "six",           // intro + four body + conclusion (four relationships)
      paraModels: ["teeec", "tdecc"],    // student-selectable paragraph structure (see scaffolds)
      // ---- concept resources -------------------------------------------------
      // The "I do not understand the content" layer. Written for the syllabus
      // concept rather than assembled from whatever the student typed, in original
      // wording, at two depths: enough to unblock, then enough to actually learn
      // it. A pathway points at one of these through concept.key, so the resource
      // travels with the argument and stays open while the paragraph is written.
      concepts: {
        processes: {
          title: "Processes in the marketing mix",
          syllabus: "Marketing \u00b7 marketing strategies \u00b7 people, processes and physical evidence",
          quick: "Processes are the systems a customer moves through to get the service: how an order is placed, paid for, prepared, handed over and fixed when it goes wrong. They are part of what the customer is buying, because for a service the experience of getting it cannot be separated from the thing itself.",
          readMore: [
            "A good or a service is bought through a sequence of steps, and for a service that sequence is visible to the customer. Choosing, queuing, ordering, paying, waiting, collecting and returning are all process steps. Some are done by staff, some by equipment such as a kiosk or an app, and some by the customer themselves. The marketing decision is which steps exist at all, who performs them, in what order, and how much time and effort each one costs the customer.",
            "Processes are one of the three extra elements of the services marketing mix, alongside people and physical evidence. They are separated out because a service is intangible and is produced at the moment it is consumed, so the customer judges quality partly by how smoothly the delivery ran. A business can sell an identical product and lose to a competitor purely on the process around it.",
            "A target market changes processes because different customers are prepared to spend different things. Some will spend time but not money, some will spend money to save time, some want to control the detail of what they receive, and some want no decisions at all. Once a business identifies which of these describes its target market, the process is redesigned to remove whatever that group is least willing to give up. That is why the customer expectation is the cause and the process change is the effect, and not the other way around.",
            "Process changes are rarely free. Self service shifts work onto the customer and can suit one segment while alienating another. Extra choice at the ordering step slows the queue behind it. Faster collection can need more space, more staff at peak, or investment in equipment. A strong answer names the gain and is honest about what it costs."
          ],
          terms: [
            { term: "processes", meaning: "the systems and flow that deliver a service to the customer, such as ordering, payment, preparation, collection and returns." },
            { term: "services marketing mix", meaning: "the seven elements used for services: product, price, place, promotion, people, processes and physical evidence." },
            { term: "intangible", meaning: "cannot be seen, touched or tested before it is bought, which is why the delivery experience is used to judge quality." },
            { term: "target market", meaning: "the group of customers a business chooses to aim its marketing at, defined by shared characteristics and expectations." },
            { term: "customer service", meaning: "the way a business treats customers before, during and after a sale; processes are the machinery that makes it consistent." },
            { term: "self service", meaning: "a process design that transfers a step, such as ordering or payment, from staff to the customer." },
            { term: "throughput", meaning: "how many customers a process can serve in a given time, which is why process design matters most at peak." }
          ],
          confusions: [
            "Processes are not the product. Changing what is sold is a product strategy; changing how it is obtained is a process strategy.",
            "Processes are not place. Place is where and through which channel the customer buys; processes are the sequence of steps once they are there.",
            "Naming the technology is not analysis. An app or a kiosk is the means; the answer has to say which step it removed and for whom.",
            "The cause runs from the customer to the business. A process did not change because the technology existed, it changed because a target market would not tolerate the old one."
          ],
          example: "A hardware shop finds its main customers are tradespeople who arrive before seven in the morning and cannot wait. It adds a phone-ahead order and a collection bay at the front of the store. Nothing about the products changed; the sequence the customer moves through did, and it changed because of who the customer is.",
          related: ["people", "physical evidence", "place and distribution", "customer service"]
        }
      },
      questions: [
        { id: "ops-01", command: "How can", qtype: "A", qtypeLabel: "relationship",
          text: "How can operations strategies contribute to the achievement of performance objectives?",
          topic: "Operations", term1: "Operations strategies", term2: "Performance objectives",
          plan: ["Technology to speed and cost", "Inventory management to dependability and cost", "Quality management to quality", "Supply chain management to speed and dependability"],
          argument: "Operations strategies influence business performance by changing the quality, speed, dependability, flexibility, customisation and cost of outputs." },
        { id: "ops-02", command: "Assess", qtype: "B", qtypeLabel: "judgement",
          text: "Assess the impact of globalisation on operations management.",
          topic: "Operations", term1: "Globalisation", term2: "Operations management",
          plan: ["Global sourcing to costs and supply", "Economies of scale to cost leadership", "Scanning and learning to innovation", "Research and development to differentiation"],
          argument: "Globalisation can substantially improve cost competitiveness and innovation but exposes businesses to greater supply-chain and global risk." },
        { id: "ops-03", command: "How can", qtype: "A", qtypeLabel: "relationship",
          text: "How can operations strategies affect corporate social responsibility?",
          topic: "Operations", term1: "Operations strategies", term2: "Corporate social responsibility",
          plan: ["Supply chain and global sourcing to social responsibility", "Outsourcing to employee and community responsibilities", "Inventory and waste management to environmental sustainability", "Technology and design to environmental and social consequences"],
          argument: "Operations strategies shape a business's social and environmental responsibilities as much as its efficiency." },
        // The same schema on a Business Studies question. Requirements say what the
        // response must DO with the case study, never what the case study contains:
        // the facts live in the evidence bank, which is author-checked, and a
        // requirement that named one would be a claim this file cannot vouch for.
        { id: "mkt-01", command: "Explain", qtype: "C", qtypeLabel: "multi-element",
          marks: 20,
          requirements: {
            concepts: ["target market", "e-marketing", "people as a marketing strategy", "processes as a marketing strategy", "physical evidence as a marketing strategy"],
            // THE AUTHORITY on what this question fixes. Decode highlights point at
            // these; they never create them. Forgetting to highlight an area must
            // not make the area optional.
            requiredAreas: [
              { id: "e-marketing",      label: "e-marketing" },
              { id: "people",           label: "people" },
              { id: "processes",        label: "processes" },
              { id: "physical evidence", label: "physical evidence" }
            ],
            relationships: [
              "the characteristics of the chosen target market cause each strategy to take the form it does",
              "the same target market pulls the four elements in a consistent direction, rather than each being decided separately",
              "a strategy is a response to what the target market expects, not simply a feature the business happens to have"
            ],
            accomplish: [
              "covers all four named elements, since the question fixes them",
              "for each element, shows the causal step from a target-market characteristic to the strategy, rather than describing the strategy alone",
              "uses one business consistently so the four relationships hold together",
              "makes the case study evidence do work, saying what each detail demonstrates about the target market"
            ],
            syllabus: "Marketing: market segmentation and target markets, and the marketing strategies of e-marketing, people, processes and physical evidence."
          },
          // ------------------------------------------------------------------
          // ARGUMENT PATHWAYS. A pathway is a RELATIONSHIP the student can choose
          // to argue, never a prewritten topic sentence: they still write every
          // word. Choosing one changes the guidance for the sentences that follow,
          // filters the evidence to what actually supports it, and tells Understand
          // which concept to open. All authored, so nothing here calls a model.
          //
          // `evidence` holds labels from the verified bank. `guides` overrides the
          // scaffold's generic job for a slot, so the guide reads as if it were
          // written for this argument, because it was.
          // ------------------------------------------------------------------
          pathways: [
            { id: "mkt01-em-digital", area: "e-marketing",
              relationship: "Digitally engaged customers lead to greater use of digital marketing",
              meaning: "These customers already spend their attention on digital channels, so that is where the business has to buy it.",
              whatToProve: "customers are already on digital channels \u2192 the business moves its promotion there \u2192 why that reaches them better than the alternative",
              commonMistake: "Listing the business's digital channels without saying what it is about these customers that made digital the right choice.",
              concept: { topic: "marketing", section: "marketing strategies", point: "e-marketing" },
              evidence: ["App, loyalty rewards and mobile ordering", "Promotion mix from advertising to sponsorship"],
              guides: {
                topic: "State the relationship: a target market that spends its time on digital channels pushes the business towards e-marketing.",
                explain: "Explain WHY a target market that is highly engaged with digital technology would cause the business to market through digital channels. Name the mechanism, not the outcome.",
                example: "Apply the evidence you selected. State the relevant fact accurately first, then say what it demonstrates about the target market.",
                effect: "Say what this achieves for the business, in marketing terms rather than general benefit.",
                link: "Tie it back to the question: this is one way the target market affects e-marketing." },
              // ------------------------------------------------------------
              // THE HELP LADDER for this pathway, authored. Rungs are TYPED so
              // safety is declared rather than guessed at: a scaffoldFrame must
              // leave the meaningful content blank, and a differentContextExample
              // must be set somewhere else entirely. A rung that is not authored
              // simply does not appear.
              // ------------------------------------------------------------
              help: {
                explain: {
                  hint: "Think about where this target market spends its time, and how a business can reach them there.",
                  needs: "Show the cause and effect between the target market's digital behaviour and the business's choice of marketing channel. The customer habit is the cause.",
                  frame: { type: "scaffoldFrame", text: "Because [target-market characteristic], the business uses [strategy] to [effect]." },
                  starter: { type: "sentenceStarter", text: "A target market that is highly engaged with digital technology can influence a business's choice of marketing channel because" },
                  example: { type: "differentContextExample", context: "a gym and time-poor professionals",
                    text: "A target market of time-poor professionals may encourage a gym to offer online booking, because this lets customers arrange a session without phoning during business hours.",
                    pattern: "target-market characteristic, then strategy, then why it suits that market" } },
                example: {
                  hint: "Give the detail first. A marker cannot credit a claim about evidence they have not been shown.",
                  needs: "State the fact accurately, then say what it demonstrates. Two moves, in that order.",
                  frame: { type: "scaffoldFrame", text: "[specific detail from the evidence], which shows [what it demonstrates about the target market]." },
                  example: { type: "differentContextExample", context: "a bookshop and its loyalty card",
                    text: "The bookshop's loyalty card records what each member buys, which shows that its target market is willing to trade some privacy for a discount.",
                    pattern: "the detail, then what the detail proves" } } }, },
            { id: "mkt01-em-value", area: "e-marketing",
              relationship: "Value-conscious customers lead to digital promotions and loyalty offers",
              meaning: "These customers decide on price, and digital channels are the cheapest way to put an offer in front of them again and again.",
              whatToProve: "customers respond to price \u2192 the business needs a cheap and repeatable way to reach them with offers \u2192 digital promotions and loyalty schemes become the tool",
              commonMistake: "Arguing that discounts attract customers, which is a pricing point, rather than arguing why the offer is delivered digitally.",
              concept: { topic: "marketing", section: "marketing strategies", point: "promotion" },
              evidence: ["App, loyalty rewards and mobile ordering", "Price points from value range to McCafe"],
              guides: {
                explain: "Explain why a target market that weighs price closely would push the business towards discounting and loyalty offers delivered digitally.",
                example: "Apply the evidence you selected, stating the fact before what it shows.",
                effect: "Say what this achieves: which marketing objective it serves and at what cost." } },
            { id: "mkt01-em-convenience", area: "e-marketing",
              relationship: "Convenience-oriented customers lead to marketing through ordering apps and digital channels",
              meaning: "These customers want to act on an offer immediately, so the marketing has to sit inside the channel they already order through.",
              whatToProve: "customers want to act with the least effort \u2192 marketing has to sit where the order is placed \u2192 the ordering channel becomes a promotion channel",
              commonMistake: "Describing the app as convenient to order with, which is a processes argument, instead of arguing that it is where the marketing reaches them.",
              concept: { topic: "marketing", section: "marketing strategies", point: "e-marketing" },
              evidence: ["App, loyalty rewards and mobile ordering"],
              guides: {
                explain: "Explain why customers who value convenience make it worth marketing inside the same app they order in." } },

            { id: "mkt01-pe-service", area: "people",
              relationship: "Customers who expect personal service lead to investment in staff training and service standards",
              meaning: "These customers judge the business on the person serving them, so that staff member is part of what is being bought.",
              whatToProve: "customers expect to be dealt with personally \u2192 staff are part of the product \u2192 the business invests in training and service standards",
              commonMistake: "Saying good staff are important, which is true of every business, instead of saying what THIS target market expects that forced the investment.",
              concept: { topic: "marketing", section: "marketing strategies", point: "people, processes and physical evidence" },
              evidence: ["Intensive distribution and standardised service"],
              guides: {
                explain: "Explain why what this target market expects of an interaction changes how staff are trained and what they are asked to do.",
                example: "Apply the evidence you selected. Say what it shows about the people element specifically." } },
            { id: "mkt01-pe-speed", area: "people",
              relationship: "Customers who expect speed lead to staffing and rostering built around peak demand",
              meaning: "These customers count waiting as a cost, so the business has to have the right number of staff on at the right hour.",
              whatToProve: "customers will not wait \u2192 service capacity has to match demand hour by hour \u2192 staffing and rostering change",
              commonMistake: "Arguing about the ordering system, which is processes, rather than about the people who have to be there to deliver it.",
              concept: { topic: "marketing", section: "marketing strategies", point: "people, processes and physical evidence" },
              evidence: ["Intensive distribution and standardised service"],
              guides: {
                explain: "Explain the link between what the target market will wait for and how the business staffs its service." } },
            { id: "mkt01-pe-consistency", area: "people",
              relationship: "Customers who expect the same experience everywhere lead to standardised service training",
              meaning: "These customers are buying predictability, so what the staff do has to be the same in every store.",
              whatToProve: "customers are buying predictability \u2192 variation between staff breaks it \u2192 training and service standards are standardised",
              commonMistake: "Describing standard uniforms, signage or layout, which is physical evidence, rather than what the staff are trained to do.",
              concept: { topic: "marketing", section: "marketing strategies", point: "people, processes and physical evidence" },
              evidence: ["Standardisation with local customisation", "Intensive distribution and standardised service"],
              guides: {
                explain: "Explain why an expectation of consistency forces the business to standardise what its people do." } },

            // ---- REFERENCE AREA: processes -----------------------------------
            // Every component of the paragraph is written for the argument that was
            // chosen, not for the slot in general, and every component carries the
            // full ladder. Guides and ladders are keyed for BOTH paragraph models,
            // so a student on TEEEC (topic, explain, example, effect, link) and one
            // on TDECC (topic, demonstrate knowledge, explain, case study, connect)
            // get the same depth. Nothing here is a sentence the student can lift:
            // the direction rung names the reasoning, the starter stops mid-thought,
            // and the worked example is always somewhere else entirely.
            { id: "mkt01-pr-convenience", area: "processes",
              relationship: "Convenience-oriented customers lead to faster and more flexible ordering processes",
              meaning: "These customers treat the time and effort of ordering as a cost, so the business changes how ordering works to take steps out of it.",
              whatToProve: "customer expectation \u2192 the process change it forces \u2192 why the new process suits this market better",
              commonMistake: "Describing an app or a kiosk without explaining what it was about these customers that caused the process to change.",
              concept: { key: "processes", topic: "marketing", section: "marketing strategies", point: "people, processes and physical evidence" },
              evidence: [
                { label: "App, loyalty rewards and mobile ordering",
                  why: "It moves ordering and payment off the counter and onto the customer's own device, which is exactly the process step this argument is about.",
                  limits: "It shows the ordering process changed. It does not by itself prove customers are more satisfied, so do not claim a result you cannot support." },
                { label: "Intensive distribution and standardised service",
                  why: "Drive through lanes, delivery platforms and self service kiosks are alternative ways to place and receive the same order, which is the flexibility half of this argument.",
                  limits: "This is about place as well as process, so say plainly that you are using it for the ordering steps and not for how many outlets there are." }
              ],
              guides: {
                topic: "State the relationship between what this target market will not spend and the way the business organises ordering. Name processes as the element you are arguing about.",
                define: "Show what processes are in the marketing mix, and that ordering and payment are process steps rather than product or place.",
                explain: "Explain WHY a preference for convenience causes the ordering process to change. The cause is the customer expectation, not the availability of the technology.",
                example: "Apply the evidence you chose. State what the business actually does, then say which ordering step it removed, and for whom.",
                effect: "Say what the changed ordering process achieves for the customer and for the business, and name what it costs.",
                link: "Return to the question: identifying what this target market expects is what produced this process strategy." },
              help: {
                topic: {
                  hint: "In one line, what does this group refuse to spend, and what does the business change because of it?",
                  needs: "Open the paragraph by naming the target market's expectation and the marketing element it acts on. No evidence yet, and no explanation yet.",
                  direction: { type: "reasoningDirection", text: "Put the customer first in the sentence and the business second, so it reads as a cause rather than a coincidence. Name processes explicitly, so the marker knows which element of the mix you are arguing about." },
                  starter: { type: "sentenceStarter", text: "A target market that is unwilling to spend time or effort on ordering pushes a business to" },
                  example: { type: "differentContextExample", context: "a bank and customers who work full time",
                    text: "A customer group that will not queue for routine transactions pushes a bank to redesign how those transactions are started.",
                    pattern: "the group, what they will not do, then the process the business changes" } },
                define: {
                  hint: "If someone asked you what counts as a process here, which steps would you list?",
                  needs: "Show the marker you know what processes are, in one sentence, before you argue anything with them.",
                  direction: { type: "reasoningDirection", text: "Define processes as the steps a customer moves through to obtain the service, then name the two or three steps this paragraph is actually about. Keep it to the knowledge; the argument comes in the next line." },
                  starter: { type: "sentenceStarter", text: "Processes are the systems a customer moves through to obtain a service, including" },
                  example: { type: "differentContextExample", context: "a dental practice",
                    text: "Processes are the steps a patient moves through to obtain treatment, including booking, arrival, waiting, treatment and payment.",
                    pattern: "the definition, then the specific steps this paragraph will use" } },
                explain: {
                  hint: "Ask what this customer is unwilling to spend, and what the business changes so they do not have to.",
                  needs: "Establish the causal step from the customer expectation to the process. The expectation comes first and causes the change.",
                  direction: { type: "reasoningDirection", text: "Trace the chain in order: this group treats effort as a cost, so a business that wants their repeat custom takes steps out of ordering, so the ordering process itself is rebuilt. Say why the business had no real alternative if it wanted this group." },
                  starter: { type: "sentenceStarter", text: "Because this target market treats time and effort as a cost of buying, a business competing for it has to" },
                  example: { type: "differentContextExample", context: "a pharmacy and shift workers",
                    text: "Because shift workers cannot visit during ordinary hours, the pharmacy moved repeat prescriptions to an online request, so an order can be placed at any time.",
                    pattern: "the expectation, then the process changed, then the result" } },
                example: {
                  hint: "What does the business actually do, and which ordering step does it take away?",
                  needs: "Use the evidence as proof of the process change, not as a mention. The fact first, then what it demonstrates.",
                  direction: { type: "reasoningDirection", text: "State the practice in one clause, then in the next say which step of ordering it removed and for whom. If the sentence would still make sense with the business's name taken out, it is not applied yet." },
                  starter: { type: "sentenceStarter", text: "The business allows an order to be placed and paid for before the customer arrives, which removes" },
                  example: { type: "differentContextExample", context: "a supermarket and parents with young children",
                    text: "The supermarket lets an order be assembled online and collected from a bay in the car park, which removes the trip through the aisles for a customer who cannot easily make it.",
                    pattern: "the practice, the step removed, then the customer it was removed for" } },
                effect: {
                  hint: "Who gains, and what does the business give up to get it?",
                  needs: "Say what the changed process achieves, and be honest about its cost. A gain with no cost reads as advertising.",
                  direction: { type: "reasoningDirection", text: "Name the gain for the customer, then the gain for the business, then one genuine trade-off, such as work shifted onto the customer or a group that finds the new process harder than the old one." },
                  starter: { type: "sentenceStarter", text: "The result is that this target market spends less effort to buy, which for the business means" },
                  example: { type: "differentContextExample", context: "a council library",
                    text: "The result is that borrowers collect reserved items without queuing, which raises the number served at peak, although members who are less confident with the system now need help they did not need before.",
                    pattern: "customer gain, business gain, then the honest cost" } },
                link: {
                  hint: "What did this paragraph prove about the question, in one line?",
                  needs: "Return to the question. The point is that identifying the target market is what produced the strategy.",
                  direction: { type: "reasoningDirection", text: "Say what the paragraph has demonstrated rather than repeating what the business did, and use the words of the question so the marker can see the claim being answered." },
                  starter: { type: "sentenceStarter", text: "This shows that identifying a convenience-driven target market is what led the business to" },
                  example: { type: "differentContextExample", context: "a bank and customers who work full time",
                    text: "This shows that identifying who the customers were is what led the bank to redesign the process, rather than the technology arriving first.",
                    pattern: "the judgement, put in the question's own terms" } } } },

            { id: "mkt01-pr-speed", area: "processes",
              relationship: "Customers who expect speed lead to streamlined service and collection processes",
              meaning: "These customers are paying for turnaround, so the business reorganises what happens after payment to cut the wait.",
              whatToProve: "customers count waiting as a cost \u2192 steps are separated or run alongside each other \u2192 the wait falls, especially at peak",
              commonMistake: "Claiming the business is faster without naming which step was taken out of the queue.",
              concept: { key: "processes", topic: "marketing", section: "marketing strategies", point: "people, processes and physical evidence" },
              evidence: [
                { label: "App, loyalty rewards and mobile ordering",
                  why: "An order placed before arrival means preparation can start earlier, which is how the wait at the counter is cut rather than merely moved.",
                  limits: "The app changes when the order is placed. Say how that shortens the wait, or the link to speed is assumed rather than argued." },
                { label: "Intensive distribution and standardised service",
                  why: "Drive through lanes, separate collection points and standardised service steps exist to move a queue, which is the collection half of this argument.",
                  limits: "Use it for how service is organised, not for how many outlets there are." }
              ],
              guides: {
                topic: "State that this target market's expectation is about time, and that it acts on how service and collection are organised.",
                define: "Show what processes cover, and that preparation, handover and collection are process steps.",
                explain: "Explain the causal step from an expectation of speed to the way service and collection are organised. Speed is part of what is being sold.",
                example: "Apply your evidence to the wait itself. Name the step that was moved, separated or run alongside another.",
                effect: "Say what shorter waiting does for the customer and for the business at peak, and what it costs.",
                link: "Return to the question: the expectation of speed is what shaped this process strategy." },
              help: {
                topic: {
                  hint: "What exactly is this customer buying, besides the product itself?",
                  needs: "Open by naming the expectation as a time expectation, and name processes as the element it acts on.",
                  direction: { type: "reasoningDirection", text: "Make time the subject of the sentence, so the paragraph cannot drift into being about the product or the price, and say which part of the process, service or collection, you are going to argue about." },
                  starter: { type: "sentenceStarter", text: "A target market that treats waiting as the main cost of buying pushes a business to" },
                  example: { type: "differentContextExample", context: "a printing shop and small businesses",
                    text: "A customer group that is paying for turnaround as much as for the print pushes the shop to reorganise how jobs are queued and collected.",
                    pattern: "the expectation named as time, then the process it acts on" } },
                define: {
                  hint: "Which steps happen after the customer has already paid?",
                  needs: "Show what processes are, and locate preparation, handover and collection inside them.",
                  direction: { type: "reasoningDirection", text: "Define processes as the delivery sequence, then name the steps that happen after payment, because those are the ones this paragraph changes. Define the process, not speed." },
                  starter: { type: "sentenceStarter", text: "Processes are the sequence that delivers a service, and the steps that follow payment are" },
                  example: { type: "differentContextExample", context: "a dental practice",
                    text: "Processes are the sequence that delivers the service, and the steps after booking are arrival, waiting, treatment and follow-up.",
                    pattern: "define the sequence, then name the steps in scope" } },
                explain: {
                  hint: "Why can a business chasing this group not simply do the same thing faster?",
                  needs: "Establish that the expectation forces a structural change to the sequence, not just more effort from the staff.",
                  direction: { type: "reasoningDirection", text: "Trace it: this group counts waiting as a cost, so a business competing for them takes steps out of the queue or runs them alongside each other, so preparation and collection separate from ordering. Say why working harder is not the same as redesigning." },
                  starter: { type: "sentenceStarter", text: "Because this target market counts waiting as part of the price, a business competing for it has to" },
                  example: { type: "differentContextExample", context: "an airport cafe",
                    text: "Because travellers count minutes against a departure time, the cafe separated ordering from collection so drinks are made while the next customer is still paying.",
                    pattern: "the expectation, the step separated, then the time saved" } },
                example: {
                  hint: "Which step now happens somewhere else, or at the same time as another?",
                  needs: "Use the evidence to show a step that was moved, separated or run in parallel. The fact, then what it demonstrates about the wait.",
                  direction: { type: "reasoningDirection", text: "State what the business does, then name the step it took out of the queue. Aim at the wait itself: if your sentence never mentions time or order, it is describing a channel rather than a process." },
                  starter: { type: "sentenceStarter", text: "The business takes the order and the payment before the customer arrives, so that" },
                  example: { type: "differentContextExample", context: "a supermarket",
                    text: "The supermarket routes online orders to a separate picking team, so the trolleys never enter the checkout queue that walk-in customers are standing in.",
                    pattern: "the practice, the step separated, then the queue it protects" } },
                effect: {
                  hint: "What happens at the busiest hour, and who pays for it?",
                  needs: "Say what shorter waiting does for the customer and for the business, and name the cost of achieving it.",
                  direction: { type: "reasoningDirection", text: "Put the gain in terms of how many customers can be served at peak, because that is where speed is worth money, then name a real cost such as extra space, extra staff, or a second queue that has to be managed." },
                  starter: { type: "sentenceStarter", text: "The effect is that more customers can be served in the same peak hour, which matters because" },
                  example: { type: "differentContextExample", context: "a council library",
                    text: "The effect is that the desk clears faster at closing time, which lets the same staff handle more borrowers, although the separate collection shelf takes floor space the branch does not really have.",
                    pattern: "the gain at peak, why it matters, then the honest cost" } },
                link: {
                  hint: "What has this paragraph shown about the question itself?",
                  needs: "Return to the question and say what the expectation of speed produced.",
                  direction: { type: "reasoningDirection", text: "Name the target market characteristic and the strategy it produced in the same sentence, so the causal claim the question makes is the thing you actually land." },
                  starter: { type: "sentenceStarter", text: "This demonstrates that reading the target market's expectation of speed is what produced" },
                  example: { type: "differentContextExample", context: "an airport cafe",
                    text: "This demonstrates that reading who the customers were, and what they were short of, is what produced the change in how the service was organised.",
                    pattern: "the characteristic, then the strategy it produced" } } } },

            { id: "mkt01-pr-customisation", area: "processes",
              relationship: "Customers who want to customise orders lead to ordering systems built to take variations",
              meaning: "These customers expect to change what they order, so the process has to carry a non-standard order without errors.",
              whatToProve: "customers expect to change the order \u2192 no two orders are identical \u2192 the ordering system has to capture the variation accurately",
              commonMistake: "Arguing about choice on the menu, which is a product point, instead of about how the process carries a non-standard order.",
              concept: { key: "processes", topic: "marketing", section: "marketing strategies", point: "people, processes and physical evidence" },
              evidence: [
                { label: "App, loyalty rewards and mobile ordering",
                  why: "An order entered by the customer records a variation exactly and carries it through without a spoken exchange, which is the accuracy problem this argument turns on.",
                  limits: "Show the variation being captured. Saying the app exists does not prove the ordering system was built to take variations." },
                { label: "Standardisation with local customisation",
                  why: "It shows the business already varies what it offers between markets, so you can argue that variation has to be handled somewhere in the process.",
                  limits: "This is variation in the menu, not variation in one customer's order. Say which of the two you mean or the example will not land." },
                { label: "Segments served by Happy Meal and McCafe",
                  why: "Different ranges for different segments mean one ordering process has to carry several kinds of order at once.",
                  limits: "This sits closer to segmentation than to processes, so make the process point explicitly rather than assuming it." }
              ],
              guides: {
                topic: "State that this target market expects to alter its order, and that this acts on how the ordering system is built.",
                define: "Show what processes cover, and that capturing an order and passing it on accurately are process steps.",
                explain: "Explain why a target market that expects to change an order shapes how the ordering system has to work, and why accuracy is the pressure point.",
                example: "Apply your evidence to the capture of a variation. State what the business does, then what it proves about handling variety.",
                effect: "Say what handling variation reliably achieves, and what it costs the rest of the queue.",
                link: "Return to the question: the expectation of choice is what shaped the ordering process." },
              help: {
                topic: {
                  hint: "What does this customer expect to be able to change, and where in the process does that land?",
                  needs: "Open by naming the expectation as an expectation of choice, and name the ordering system as what it acts on.",
                  direction: { type: "reasoningDirection", text: "Make the expectation about variation rather than about speed or effort, so this paragraph is clearly a different argument from a convenience one, and name the ordering system as the process under pressure." },
                  starter: { type: "sentenceStarter", text: "A target market that expects to alter what it orders pushes a business to build an ordering system that" },
                  example: { type: "differentContextExample", context: "a paint retailer and trade customers",
                    text: "A customer group that expects a colour mixed to its own specification pushes the retailer to build an ordering system that can record and repeat that specification.",
                    pattern: "the expectation as variation, then the system it forces" } },
                define: {
                  hint: "What has to happen to an order between the customer saying it and the kitchen making it?",
                  needs: "Show what processes are, and that recording an order and passing it on accurately are process steps.",
                  direction: { type: "reasoningDirection", text: "Define processes as the delivery sequence, then isolate the step that records what was asked for, because that is where variation is won or lost. Define the process, not customisation." },
                  starter: { type: "sentenceStarter", text: "Processes are the systems that deliver a service, and the step that records what the customer asked for is" },
                  example: { type: "differentContextExample", context: "a tailor",
                    text: "Processes are the systems that deliver the service, and the step that records the measurements and passes them to the workroom is where an error becomes expensive.",
                    pattern: "define the sequence, then isolate the step at risk" } },
                explain: {
                  hint: "What goes wrong if the process cannot carry the variation accurately?",
                  needs: "Establish that the expectation of choice creates an accuracy problem, and that the process is where it has to be solved.",
                  direction: { type: "reasoningDirection", text: "Trace it: this group expects to change the order, so no two orders are identical, so a process built for identical orders starts producing mistakes and delays. Say why the system had to change rather than the staff being asked to remember more." },
                  starter: { type: "sentenceStarter", text: "Because this target market expects to change what it receives, every order becomes slightly different, which means" },
                  example: { type: "differentContextExample", context: "a paint retailer",
                    text: "Because each trade customer expects a mix to their own specification, no two orders are identical, so a process that relied on staff memory began producing the wrong colour.",
                    pattern: "the expectation, the variety it creates, then the failure the old process produced" } },
                example: {
                  hint: "How does the variation get recorded, and who records it?",
                  needs: "Use the evidence to show a variation being captured, not simply an order being placed.",
                  direction: { type: "reasoningDirection", text: "State what the business does, then say what happens to a non-standard order inside it. If your sentence would read exactly the same for an ordinary order, it has not shown customisation yet." },
                  starter: { type: "sentenceStarter", text: "The business lets the customer build the order themselves before it is sent through, which means a change to it is" },
                  example: { type: "differentContextExample", context: "a supermarket deli counter",
                    text: "The counter takes the thickness and the quantity on the ticket itself, so an unusual request is carried through to the slicer instead of being repeated across a queue.",
                    pattern: "the practice, the variation captured, then the error avoided" } },
                effect: {
                  hint: "What does the business gain, and what does the customer behind them lose?",
                  needs: "Say what handling variation reliably achieves, and name what it costs the rest of the queue.",
                  direction: { type: "reasoningDirection", text: "Name the gain as accuracy and repeat custom rather than speed, then be honest that choice at the ordering step slows the people waiting, and say how the business manages that tension." },
                  starter: { type: "sentenceStarter", text: "The effect is that a non-standard order is filled correctly the first time, which matters because" },
                  example: { type: "differentContextExample", context: "a tailor",
                    text: "The effect is that alterations are right the first time, which protects a reputation built on fit, although taking the detail properly makes each appointment longer than a simple sale.",
                    pattern: "the accuracy gain, why it matters, then the honest cost in time" } },
                link: {
                  hint: "What does this paragraph prove about the question?",
                  needs: "Return to the question and name what the expectation of choice produced.",
                  direction: { type: "reasoningDirection", text: "Land the judgement on the direction of cause: the target market's appetite for variation produced the ordering system, and not the other way round." },
                  starter: { type: "sentenceStarter", text: "This shows that the expectation of choice within the target market is what shaped" },
                  example: { type: "differentContextExample", context: "a paint retailer",
                    text: "This shows that what the customers expected to be able to change is what shaped the ordering system, rather than the system arriving first and then offering choice.",
                    pattern: "the characteristic, the strategy, then the direction of cause" } } } },

            { id: "mkt01-ph-servicescape", area: "physical evidence",
              relationship: "Customers who judge a business by its surroundings lead to a designed servicescape",
              meaning: "These customers cannot test the service before buying it, so they judge it by the room, and the room has to be designed.",
              whatToProve: "the service is intangible \u2192 customers judge it by what they can see \u2192 the setting is designed rather than left to chance",
              commonMistake: "Listing what the premises look like without saying what the customer concludes from it.",
              concept: { topic: "marketing", section: "marketing strategies", point: "people, processes and physical evidence" },
              evidence: ["Standardisation with local customisation", "Segments served by Happy Meal and McCafe"],
              guides: {
                explain: "Explain why what this target market reads into a physical space causes the business to design that space deliberately.",
                example: "Apply the evidence you selected, stating the fact before what it shows about physical evidence." } },
            { id: "mkt01-ph-segments", area: "physical evidence",
              relationship: "Serving different segments leads to different physical settings for each",
              meaning: "More than one group is being served and they do not want the same surroundings, so the space is divided between them.",
              whatToProve: "more than one segment is served \u2192 one setting cannot suit both \u2192 the space is divided so each gets its own",
              commonMistake: "Naming the segments and the products built for them, which is segmentation, without ever getting to the physical space.",
              concept: { topic: "marketing", section: "marketing strategies", point: "market segmentation" },
              evidence: ["Segments served by Happy Meal and McCafe"],
              guides: {
                explain: "Explain why serving more than one segment forces the physical setting to differ between them." } },
            { id: "mkt01-ph-selfservice", area: "physical evidence",
              relationship: "Customers who prefer to serve themselves lead to physical evidence built around self-service",
              meaning: "These customers would rather use a machine than ask someone, so what they can see has to explain itself.",
              whatToProve: "customers prefer to serve themselves \u2192 the surroundings have to do the explaining \u2192 screens, signage and layout are built to be self-explanatory",
              commonMistake: "Arguing that self-service is faster, which is a processes point, rather than about what the customer sees and touches.",
              concept: { topic: "marketing", section: "marketing strategies", point: "people, processes and physical evidence" },
              evidence: ["App, loyalty rewards and mobile ordering", "Intensive distribution and standardised service"],
              guides: {
                explain: "Explain why a preference for serving themselves changes what the business puts in front of the customer." } }
          ],
          criteria: { bands: null, source: "general HSC band expectations" },
          // ---- DECODE ------------------------------------------------------
          // Student-facing interpretation of the question, and nothing else.
          // What the response must COVER and ACCOMPLISH is not repeated here: it
          // is derived from `requirements` above, which stays the single source
          // of truth. Only what cannot be safely derived is authored: which words
          // in the stem are worth pressing, what the directive means, the question
          // in plain English, and the relationship the whole answer turns on.
          //
          // Anchors are strings, never character offsets, and the build asserts
          // that each one occurs exactly once in the canonical stem.
          decode: {
            verbMeaning: "Explain means show how or why. For each area you have to establish a cause and an effect, not describe the strategy on its own.",
            plainEnglish: "Show how knowing who the customers are changes the way a business uses digital marketing, its staff, its service processes and its physical surroundings.",
            coreRelationship: "A business identifies characteristics and expectations within its target market, then adapts each marketing strategy to suit those customers.",
            // What the panel is CALLED is authored per highlight, because a label
            // written for this question teaches better than a word the student has
            // to decode first. `kind` drives behaviour and stays internal.
            highlights: [
              { anchor: "Explain", kind: "directive", label: "what you need to do",
                note: "Show how or why one thing affects another. Describing each strategy on its own will not answer this question, however accurate the description is. Explain is the directive verb here." },
              { anchor: "target markets", kind: "cause", label: "the cause in the question",
                note: "Ask what characteristics, behaviours and expectations this group of customers has, because everything else in your answer follows from that." },
              { anchor: "e-marketing", kind: "requiredArea", ref: "e-marketing", label: "must cover",
                note: "Show how a characteristic of the target market causes the business's digital marketing to take the form it does." },
              { anchor: "people", kind: "requiredArea", ref: "people", label: "must cover",
                note: "Show how what customers expect of the staff who serve them causes changes to training, skills and service standards." },
              { anchor: "processes", kind: "requiredArea", ref: "processes", label: "must cover",
                note: "Show how customer characteristics cause the ordering, service or collection process to be built the way it is." },
              { anchor: "physical evidence", kind: "requiredArea", ref: "physical evidence", label: "must cover",
                note: "Show how customer characteristics cause the physical surroundings, layout and presentation to be designed as they are." }
            ],
            // The synthesis a student can act on. The full checklist stays in
            // `requirements`, where the marker reads it; this is what teaching it
            // looks like, and it is deliberately shorter.
            cover: {
              forEach: "target-market characteristic \u2192 strategy change \u2192 case-study evidence \u2192 what that evidence demonstrates",
              consistency: "Use one business consistently across the whole response."
            }
          },
          // ---- the core answer ----------------------------------------------
          // What the whole question turns on, taught before the plan is built and
          // collapsed the moment the student says they have it. Authored, never
          // generated, and never a gate: planning works whether it is read or not.
          coreAnswer: {
            explain: [
              "A target market is not everyone who might buy. It is the group a business has chosen, described by what those people are actually like: what they can spend, how they buy, how much time they will give it, what they will not put up with. Choosing that group is a decision, and every marketing decision after it is downstream of that one.",
              "So the four elements this question names are not free choices. Each is built to suit somebody in particular. Change who the customer is and the same business would promote differently, staff differently, run its service differently and look different inside. That is the relationship you have to explain, four times over."
            ],
            thesisIdea: "Say that the customer group comes first and that the strategies follow from it, then name the four elements you are going to show it in.",
            acceptableThesis: "Target markets affect e-marketing, people, processes and physical evidence because a business adapts each of these strategies to suit the characteristics, behaviours and expectations of the customers it has chosen to serve.",
            checklist: [
              "makes the target market the cause, not one factor among several",
              "says the marketing strategies change in response to it",
              "carries the relationship across all four named elements",
              "answers explain, rather than listing what the four elements are"
            ]
          },
          // ---- area guidance -----------------------------------------------
          // The fallback chain for a component guide is:
          //     pathway.guides[slot]  ->  areas[area].guides[slot]  ->  slot.job
          // The last of those is scaffold language written for no question in
          // particular, so an area layer keeps a chosen argument from ever being
          // answered with it. A pathway still overrides its own area.
          areas: {
            "e-marketing": {
              label: "e-marketing",
              guides: {
                topic:   "State which characteristic of the target market is acting, and say that it acts on the business's digital marketing.",
                define:  "Show what e-marketing covers: reaching and selling to customers through digital channels such as a website, an app, social media and email.",
                explain: "Explain why that customer characteristic makes digital channels the ones worth using. The customer comes first in the chain, not the technology.",
                example: "Apply your evidence. Say what the business actually does digitally, then what it shows about who it is selling to.",
                effect:  "Say what the digital strategy achieves for the customer and for the business, and name what it costs.",
                link:    "Return to the question: this is one way the target market shapes e-marketing." }
            },
            "people": {
              label: "people",
              guides: {
                topic:   "State which characteristic of the target market is acting, and say that it acts on the staff who deliver the service.",
                define:  "Show what people covers: the staff the customer deals with, and the skills, training, attitude and service standards they bring.",
                explain: "Explain why that characteristic forces the business to change who it hires, how it trains them, or what standard it holds them to.",
                example: "Apply your evidence to the staff themselves, not to the product they hand over.",
                effect:  "Say what the change in people achieves for the customer experience and for the business, and name its cost.",
                link:    "Return to the question: this is one way the target market shapes the people element." }
            },
            "processes": {
              label: "processes",
              guides: {
                topic:   "State which characteristic of the target market is acting, and say that it acts on the processes the customer moves through.",
                define:  "Show what processes covers: the steps that deliver the service, such as ordering, payment, preparation and collection.",
                explain: "Explain why that characteristic forces a step to be removed, moved or rebuilt. The customer is the cause, not the technology.",
                example: "Apply your evidence to a step in the process, and name which step it changed.",
                effect:  "Say what the changed process achieves for the customer and for the business, and be honest about its cost.",
                link:    "Return to the question: this is one way the target market shapes processes." }
            },
            "physical evidence": {
              label: "physical evidence",
              guides: {
                topic:   "State which characteristic of the target market is acting, and say that it acts on the physical evidence the business provides.",
                define:  "Show what physical evidence covers: the tangible surroundings a customer judges the service by, such as layout, fittings, signage, uniforms and packaging.",
                explain: "Explain why that characteristic causes the business to design the space and its presentation deliberately rather than by accident.",
                example: "Apply your evidence to something the customer can actually see, and say what it signals to them.",
                effect:  "Say what the designed setting achieves for the customer and for the business, and name what it costs.",
                link:    "Return to the question: this is one way the target market shapes physical evidence." }
            }
          },
          // CANONICAL STEM. Everything authored above is built around the four
          // elements this question fixes, so the exact paper wording is the
          // question, not a broader practice paraphrase of it. Decoding, plain
          // English, thesis guidance and comparison answers all read this string.
          text: "Explain how target markets affect e-marketing, people, processes and physical evidence.",
          topic: "Marketing", term1: "Target markets", term2: "Marketing strategies",
          plan: ["Target market to e-marketing", "Target market to people", "Target market to processes", "Target market to physical evidence"],
          argument: "The chosen target market shapes each of these four elements so that the strategy fits the customer." },
        // The broader question is a genuinely different, less constrained task, so
        // it keeps its own id rather than being an alias of the one above. It has
        // no authored pathways: it is a practice stem, not the reference area.
        { id: "mkt-04", command: "Explain", qtype: "C", qtypeLabel: "multi-element", marks: 20,
          text: "Explain how target markets influence the development of marketing strategies.",
          topic: "Marketing", term1: "Target markets", term2: "Marketing strategies",
          plan: ["Target market to product", "Target market to price", "Target market to promotion and e-marketing", "Target market to place, people, processes and physical evidence"],
          argument: "The chosen target market shapes every element of the marketing mix so that strategy fits the customer." },
        { id: "mkt-02", command: "Assess", qtype: "B", qtypeLabel: "judgement",
          text: "Assess the effectiveness of marketing strategies in achieving marketing objectives.",
          topic: "Marketing", term1: "Marketing strategies", term2: "Marketing objectives",
          plan: ["Product differentiation to market share", "Pricing to sales and profitability", "Promotion to awareness and sales", "Distribution and e-marketing to market expansion"],
          argument: "Marketing strategies can be effective in achieving objectives, though their success depends on fit with the market and on competitors' responses." },
        { id: "mkt-03", command: "To what extent", qtype: "B", qtypeLabel: "judgement",
          text: "To what extent do influences on marketing determine business success?",
          topic: "Marketing", term1: "Influences on marketing", term2: "Business success",
          plan: ["Psychological influences", "Sociocultural influences", "Economic influences", "Government, legal and ethical influences"],
          argument: "Influences significantly shape customer behaviour and constrain decisions, though management's response ultimately determines their effect on success." },
        // ---------------------------------------------------------------------
        // SECOND ARCHITECTURE CASE. Unlike mkt-01, this question names a cause
        // and an effect but FIXES NO AREAS. There is no requirements.requiredAreas,
        // so the strategies below are relationships a student may argue, not
        // paragraphs they must write. Nothing here is special-cased: the same
        // fields drive it, and what changes is that the student chooses which
        // strategies to cover as well as what to say about them.
        // ---------------------------------------------------------------------
        { id: "fin-01", command: "How can", qtype: "A", qtypeLabel: "relationship", marks: 20,
          text: "How can financial strategies affect the objectives of financial management?",
          topic: "Finance", term1: "Financial management strategies", term2: "Objectives of financial management",
          note: "2024 HSC Section IV question.",
          requirements: {
            concepts: ["financial management strategies", "objectives of financial management", "liquidity", "profitability", "efficiency", "growth", "solvency"],
            relationships: [
              "a strategy is chosen because of the objective it is meant to move, so the objective comes first and the strategy answers it",
              "one strategy can serve one objective while working against another, so the trade-off is part of the answer",
              "the objective the business is under pressure on decides which strategy is worth using"
            ],
            accomplish: [
              "defines both financial strategies and the objectives of financial management before arguing between them",
              "for each strategy chosen, shows how it moves a NAMED objective rather than describing the strategy alone",
              "weighs at least one trade-off, because no strategy improves every objective at once",
              "uses one business consistently so the strategies can be compared against each other"
            ],
            syllabus: "Finance: financial management strategies, and the objectives of liquidity, profitability, efficiency, growth and solvency."
          },
          decode: {
            verbMeaning: "How can asks you to show the mechanism. It is not enough to say that a strategy helps; you have to say how it moves the objective and why that follows.",
            plainEnglish: "Show how the things a business does with its money change how well it meets its financial goals, and be honest that fixing one goal can hurt another.",
            coreRelationship: "A business chooses a financial strategy because of the objective it needs to move, so the objective explains the strategy rather than the other way round.",
            highlights: [
              { anchor: "How can", kind: "directive", label: "what you need to do",
                note: "Show the mechanism. Saying a strategy is beneficial is not an answer; saying how it changes the objective, step by step, is." },
              { anchor: "financial strategies", kind: "cause", label: "the thing you are arguing from",
                note: "These are what the business does with its money: managing cash flow, working capital, costs and revenues, and financial risk across borders. Which ones you write about is your choice." },
              { anchor: "objectives of financial management", kind: "effect", label: "what has to move",
                note: "Liquidity, profitability, efficiency, growth and solvency. Every strategy you raise has to be tied to one of these by name, or the relationship is not shown." }
            ],
            // No fixed areas, so the coverage note is about the SHAPE of the answer
            // rather than a list of parts. The absence of requiredAreas is the
            // question's own decision, not missing data.
            cover: {
              forEach: "financial strategy → the objective it moves → how it moves it → what it costs elsewhere",
              consistency: "Choose the strategies yourself, use one business throughout, and weigh at least one trade-off."
            }
          },
          coreAnswer: {
            explain: [
              "The objectives of financial management are the things a business is trying to be: liquid enough to pay what falls due, profitable, efficient with what it owns, growing, and solvent over the long run. They are the scoreboard.",
              "A financial strategy is a move made on that scoreboard. Nobody manages cash flow for its own sake; they do it because liquidity is under pressure. So the question is asking you to run the argument in that direction: name the objective, then show the strategy reaching it. And because the objectives pull against each other, a strategy that lifts one will usually cost something on another, which is where the marks are."
            ],
            thesisIdea: "Say that strategies are chosen to move particular objectives, name the ones you will argue, and signal that improving one can cost another.",
            acceptableThesis: "Financial strategies affect the objectives of financial management because each strategy is chosen to move a particular objective, such as cash flow management improving liquidity or cost controls improving profitability, although a strategy that lifts one objective often works against another.",
            checklist: [
              "makes the objective the thing being moved, and the strategy the thing doing the moving",
              "names specific strategies and specific objectives rather than talking about finance in general",
              "signals that a trade-off is coming, since no strategy improves everything",
              "answers how, rather than listing what the strategies are"
            ]
          },
          areas: {
            "cash flow management": { label: "cash flow management", guides: {
              topic:   "State which objective is under pressure, and say that cash flow management is the strategy answering it.",
              define:  "Show what cash flow management covers: distribution of payments, discounts for early payment, and factoring.",
              explain: "Explain how changing the TIMING of money in and out changes the objective. Timing is the mechanism.",
              example: "Apply your evidence to the timing of cash, not to how much the business earns.",
              effect:  "Say what the objective gains, and what the timing change costs the business.",
              link:    "Return to the question: this is how a cash flow strategy reaches that objective." } },
            "working capital management": { label: "working capital management", guides: {
              topic:   "State which objective is under pressure, and say that working capital management is the strategy answering it.",
              define:  "Show what working capital management covers: controlling current assets and current liabilities, and leasing.",
              explain: "Explain how holding, releasing or financing assets differently changes the objective.",
              example: "Apply your evidence to what the business owns and owes, not to its sales.",
              effect:  "Say what the objective gains, and what is given up by financing it that way.",
              link:    "Return to the question: this is how a working capital strategy reaches that objective." } },
            "profitability management": { label: "profitability management", guides: {
              topic:   "State which objective is under pressure, and say that cost or revenue controls are the strategy answering it.",
              define:  "Show what profitability management covers: cost controls such as fixed and variable costs, and revenue controls such as pricing policy and sales mix.",
              explain: "Explain how moving a cost or a price changes the objective, and by what route.",
              example: "Apply your evidence to a cost or a price, and say which one it is.",
              effect:  "Say what the objective gains, and what the control costs elsewhere.",
              link:    "Return to the question: this is how a profitability strategy reaches that objective." } },
            "global financial management": { label: "global financial management", guides: {
              topic:   "State which objective is exposed, and say that a global financial strategy is what answers it.",
              define:  "Show what global financial management covers: exchange rates, interest rates, methods of international payment, and hedging.",
              explain: "Explain how the strategy removes or reduces a risk, and how removing that risk moves the objective.",
              example: "Apply your evidence to the exposure itself, not to trading overseas in general.",
              effect:  "Say what the objective gains, and what protection costs.",
              link:    "Return to the question: this is how a global financial strategy reaches that objective." } }
          },
          pathways: [
            { id: "fin01-cf-liquidity", area: "cash flow management",
              relationship: "Managing the timing of payments improves liquidity",
              meaning: "Liquidity is about whether cash is there when a bill falls due, so moving money in earlier and out later fixes it without earning a cent more.",
              whatToProve: "liquidity is under pressure → the timing of inflows and outflows is changed → cash is available when it is needed",
              commonMistake: "Treating liquidity as the same thing as profit. A profitable business can still fail to pay a bill on the day it is due.",
              concept: { topic: "finance", section: "financial management strategies", point: "cash flow management" },
              evidence: [{ label: "Immediate cash sales, almost no customer receivables",
                           why: "It shows money arriving at the moment of sale rather than weeks later, which is the timing point this argument turns on.",
                           limits: "This is about when cash arrives, not how much. Do not use it to argue profitability." }],
              guides: { explain: "Explain how the timing change, not the amount, is what improves liquidity." } },
            { id: "fin01-cf-discounts", area: "cash flow management",
              relationship: "Offering discounts for early payment brings cash forward at a cost to revenue",
              meaning: "The business pays for speed: customers hand over money sooner, and in exchange the business collects less of it.",
              whatToProve: "cash is needed sooner → customers are given a reason to pay early → liquidity improves while revenue falls",
              commonMistake: "Presenting the discount as a free improvement instead of naming what it costs.",
              concept: { topic: "finance", section: "financial management strategies", point: "cash flow management" },
              evidence: [],
              guides: { explain: "Explain the exchange being made: earlier cash bought with lower revenue." } },
            { id: "fin01-wc-control", area: "working capital management",
              relationship: "Controlling current assets and liabilities keeps the business able to meet its debts",
              meaning: "What the business holds and what it owes in the short term decide whether it can pay, so managing both is how liquidity is protected day to day.",
              whatToProve: "short-term obligations exist → current assets and liabilities are managed against them → the business stays able to pay",
              commonMistake: "Listing current assets and liabilities without saying what managing them actually changes.",
              concept: { topic: "finance", section: "financial management strategies", point: "working capital management" },
              evidence: [{ label: "Property, leasing and working capital",
                           why: "It shows the choice between owning and leasing, which is a working capital decision with a visible consequence.",
                           limits: "Say which objective you are arguing about; this evidence can support liquidity or efficiency and they are not the same." }],
              guides: { explain: "Explain how the balance between what is owned and what is owed decides the objective." } },
            { id: "fin01-wc-leasing", area: "working capital management",
              relationship: "Leasing rather than buying preserves working capital but raises ongoing costs",
              meaning: "Not spending the cash keeps it available for everything else, and the price of that is a payment that never stops.",
              whatToProve: "a large asset is needed → leasing avoids tying cash up in it → liquidity is protected while costs rise",
              commonMistake: "Arguing that leasing is cheaper. It usually is not; the argument is about what it does to available cash.",
              concept: { topic: "finance", section: "financial management strategies", point: "working capital management" },
              evidence: [{ label: "Property, leasing and working capital",
                           why: "It is the leasing decision itself, which is exactly what this argument is about.",
                           limits: "Do not claim a figure for the saving; the argument is about the effect on cash, not its size." }],
              guides: { explain: "Explain what is gained by not spending the cash, and what the ongoing payment costs." } },
            { id: "fin01-pm-cost", area: "profitability management",
              relationship: "Cost controls raise profitability by reducing what each sale costs to make",
              meaning: "Profit is what is left after costs, so pushing costs down lifts it without needing a single extra customer.",
              whatToProve: "profitability is under pressure → fixed or variable costs are cut → more of each sale is kept",
              commonMistake: "Naming a cost-cutting measure without saying which costs it touches or what it does to quality.",
              concept: { topic: "finance", section: "financial management strategies", point: "profitability management" },
              evidence: [{ label: "Standardisation as cost control, marketing as revenue control",
                           why: "It separates the cost side from the revenue side, which is the distinction this argument depends on.",
                           limits: "Use the cost half here. The revenue half belongs to a different argument." }],
              guides: { explain: "Explain the route from a lower cost to a higher profit, and name which costs move." } },
            { id: "fin01-pm-revenue", area: "profitability management",
              relationship: "Revenue controls raise profitability by lifting sales and the margin on them",
              meaning: "The other way to more profit is more revenue, through what is charged and what customers are encouraged to add.",
              whatToProve: "profitability is under pressure → pricing or sales mix is changed → revenue rises faster than the cost of earning it",
              commonMistake: "Arguing that more sales means more profit, without dealing with what the extra sales cost to serve.",
              concept: { topic: "finance", section: "financial management strategies", point: "profitability management" },
              evidence: [{ label: "Two levels of margin, restaurant and corporation",
                           why: "It shows margin being managed at more than one level, which is what a revenue control looks like in practice.",
                           limits: "Margins move for many reasons. Argue the strategy, not the number." }],
              guides: { explain: "Explain the route from a pricing or mix decision to a higher profit." } },
            { id: "fin01-gf-hedging", area: "global financial management",
              relationship: "Hedging exchange rate exposure protects profitability from currency movement",
              meaning: "A business earning in one currency and paying in another can lose money without selling any less, and hedging fixes the rate so that cannot happen.",
              whatToProve: "the business is exposed to a currency it does not control → the rate is fixed in advance → profit stops depending on the exchange rate",
              commonMistake: "Describing what a hedge is without saying which objective it protects, or claiming it makes money rather than removing a risk.",
              concept: { topic: "finance", section: "financial management strategies", point: "global financial management" },
              evidence: [{ label: "Exchange rate exposure and hedging",
                           why: "It is the exposure and the response together, which is the whole of this argument.",
                           limits: "Hedging removes uncertainty; it does not guarantee a better outcome. Do not argue that it increases profit." }],
              guides: { explain: "Explain that the gain is certainty, and say which objective that certainty protects." } },
            { id: "fin01-gf-payment", area: "global financial management",
              relationship: "Choosing the method of international payment manages the risk of not being paid",
              meaning: "Selling across a border means trusting someone a long way away, and the payment method decides how much of that risk the business carries.",
              whatToProve: "payment is uncertain across a border → a method is chosen that shifts who carries the risk → the business is more likely to be paid",
              commonMistake: "Listing payment methods in order of risk without arguing why the business would choose one.",
              concept: { topic: "finance", section: "financial management strategies", point: "global financial management" },
              evidence: [],
              guides: { explain: "Explain who carries the risk under the method chosen, and what that protects." } }
          ],
          criteria: { bands: null, source: "general HSC band expectations" },
          plan: ["Cash flow management to liquidity", "Working capital management to liquidity and efficiency", "Profitability management to profitability and growth", "Global financial management to profitability and solvency"],
          argument: "Financial strategies substantially help businesses achieve financial objectives by controlling cash, working capital, costs, revenues and financial risk, though achieving one objective can involve a trade-off with another." },
        { id: "fin-02", command: "Explain", qtype: "C", qtypeLabel: "multi-element",
          text: "Explain how financial strategies can achieve liquidity and profitability objectives.",
          topic: "Finance", term1: "Financial management strategies", term2: "Liquidity and profitability",
          note: "2025 HSC finance question. Constrained selection: liquidity and profitability are mandatory targets.",
          plan: ["Distribution of payments to liquidity", "Factoring and early-payment discounts to liquidity", "Working capital controls to liquidity", "Cost and revenue controls to profitability"],
          argument: "Financial strategies can achieve both liquidity and profitability, but the same strategy can help one objective while costing the other." },
        { id: "fin-03", command: "Assess", qtype: "B", qtypeLabel: "judgement",
          text: "Assess the impact of influences on the financial management of a business.",
          topic: "Finance", term1: "Influences on financial management", term2: "Financial management and performance",
          plan: ["Sources of finance", "Financial institutions", "Government", "Global market influences"],
          argument: "The significance of each influence depends on the business's financial position and activities, though global market conditions can be particularly significant for large and international businesses." },
        { id: "hr-01", command: "Evaluate", qtype: "B", qtypeLabel: "judgement",
          text: "Evaluate the effectiveness of human resource strategies in improving business performance.",
          topic: "Human Resources", term1: "Human resource strategies", term2: "Business performance",
          plan: ["Leadership style to satisfaction and culture", "Training and development to productivity and skills", "Performance management and rewards to turnover and performance", "Dispute resolution to disputation and satisfaction"],
          argument: "Human resource strategies can be effective in improving performance, measured against indicators such as turnover, absenteeism, disputation and worker satisfaction." },
        { id: "hr-02", command: "Analyse", qtype: "A", qtypeLabel: "relationship",
          text: "Analyse how key influences affect human resource management.",
          topic: "Human Resources", term1: "Key influences", term2: "Human resource management",
          plan: ["Stakeholders", "Legal influences", "Economic influences", "Technological, social and ethical influences"],
          argument: "Key influences shape human resource decisions by changing the expectations, constraints and conditions managers must respond to." },
        { id: "hr-03", command: "To what extent", qtype: "B", qtypeLabel: "judgement",
          text: "To what extent can human resource processes contribute to effective human resource management?",
          topic: "Human Resources", term1: "Human resource processes", term2: "Effective human resource management",
          plan: ["Acquisition to an appropriate workforce", "Development to skills and productivity", "Maintenance to retention and satisfaction", "Separation to restructuring, costs and culture"],
          argument: "Human resource processes contribute substantially to effective management, though their effect depends on how well each stage is carried out." }
      ],
      // Two selectable paragraph structures. Each overrides the BODY slot set only;
      // intro and conclusion reuse the shared light sets. Slot keys are stable and
      // are the contract with the coach worker. Content-free frames only.
      scaffolds: {
        teeec: {
          label: "TEEEC", expansion: "Topic, Explain, Example, Effect, Concluding link",
          body: [
            { key: "topic",   label: "topic",           job: "state the relationship this paragraph argues, a strategy affecting an objective" },
            { key: "explain", label: "explanation",     job: "explain how the strategy works, using business terminology" },
            { key: "example", label: "example",         job: "apply a real case study or business example" },
            { key: "effect",  label: "effect",          job: "explain the effect on the objective and why it matters to the business" },
            { key: "link",    label: "concluding link", job: "link back to the question with a clear judgement" }
          ],
          templates: {
            topic:   { tier1: "____ can affect ____ because ____.",
                       tier2: [ { type: "cause and effect", frame: "____ influences ____ by ____." } ] },
            explain: { tier1: "This works because ____ leads to ____.",
                       tier2: [ { type: "mechanism", frame: "By ____, the business is able to ____, which changes ____." } ] },
            example: { tier1: "For example, a business could ____, which shows ____." },
            effect:  { tier1: "As a result, ____ improves ____, which matters because ____.",
                       tier2: [ { type: "trade-off", frame: "This improves ____, although it can reduce ____." } ] },
            link:    { tier1: "Therefore, ____ affects ____, which addresses the question because ____." }
          }
        },
        tdecc: {
          label: "TDECC", expansion: "Topic, Demonstrate knowledge, Explain, Case study, Connect",
          body: [
            { key: "topic",   label: "topic",                job: "state the relationship this paragraph argues, a strategy affecting an objective" },
            { key: "define",  label: "demonstrate knowledge", job: "show what the syllabus concept is and what it covers, in business terminology" },
            { key: "explain", label: "explain",              job: "make the causal reasoning explicit: what causes what, and why" },
            { key: "example", label: "case study",           job: "apply your selected evidence as proof, not as a mention" },
            { key: "link",    label: "connect",              job: "return to the question and say what the example has demonstrated" }
          ],
          templates: {
            topic:   { tier1: "____ can affect ____ because ____." },
            define:  { tier1: "____ refers to ____.",
                       tier2: [ { type: "define then apply", frame: "____ is ____, which allows a business to ____." } ] },
            explain: { tier1: "This happens because ____ leads to ____.",
                       tier2: [ { type: "cause and effect", frame: "Because ____, a business ____, which changes ____." } ] },
            example: { tier1: "For example, a business could ____, which shows ____." },
            link:    { tier1: "Therefore, ____ affects ____, which addresses the question because ____." }
          }
        }
      },
      // Fixed, pre-written worked examples in the business genre, deliberately on a
      // DIFFERENT relationship from most questions so the analytical shape transfers
      // without being liftable. Generic firm ("a business"): no real company named.
      // Slots use the TEEEC keys; TDECC-only slots simply show no example.
      examples: [
        { topic: "finance-liquidity", label: "Cash flow management and liquidity", slots: {
          topic: "Cash flow management can significantly improve a business's liquidity because it changes the timing and availability of cash.",
          explain: "Strategies such as the distribution of payments, discounts for early payment and factoring alter when cash flows in and out, so more cash is available to meet short-term commitments.",
          example: "For example, a business could use factoring to sell its accounts receivable for immediate cash rather than waiting for customers to pay.",
          effect: "This increases the funds available to pay suppliers and wages, improving liquidity, although factoring carries a cost that can reduce profitability.",
          link: "Therefore, cash flow management can be highly effective in achieving liquidity, provided managers weigh the trade-off with profitability." } },
        { topic: "operations-quality", label: "Quality management and the quality objective", slots: {
          topic: "Quality management can strengthen the performance objective of quality because it builds consistency into outputs.",
          explain: "Approaches such as quality control, quality assurance and continuous improvement reduce defects and variation in the production process.",
          example: "For example, a business could introduce standardised checks at each stage of production to catch faults before goods reach customers.",
          effect: "This raises the reliability of outputs and customer satisfaction, which matters because it protects reputation and repeat sales.",
          link: "Therefore, quality management directly supports the quality objective and, through it, wider business performance." } }
      ]
    }
  },

  // Structure presets for the setup selector. The default is the five-paragraph
  // shape; a student can change it in setup and re-pick it later. "roles" drives
  // both the stepper labels and how many paragraph slots the draft holds.
  structures: [
    { key: "five",  label: "5 paragraphs (intro, 3 body, conclusion)",
      roles: ["Introduction", "Body 1", "Body 2", "Body 3", "Conclusion"] },
    { key: "four",  label: "4 paragraphs (intro, 2 body, conclusion)",
      roles: ["Introduction", "Body 1", "Body 2", "Conclusion"] },
    { key: "six",   label: "6 paragraphs (intro, 4 body, conclusion)",
      roles: ["Introduction", "Body 1", "Body 2", "Body 3", "Body 4", "Conclusion"] }
  ],
  defaultStructure: "five",

  // Generic HSC band expectations, in writable register, no em-dashes. Shown as
  // light reference in setup when a student has not pasted their own rubric. The
  // coaching model is told these same expectations server-side; this copy is for
  // the student to read, never asserted as the only right answer.
  // ---------------------------------------------------------------------------
  // bandExpectations — the general ladder an extended response is judged against
  // when no official set is authored for the question or the subject. Sent with
  // every marking request. Subject-agnostic and ORIGINAL: written for this app
  // from general knowledge of what separates a strong HSC extended response from
  // a weak one, describing observable behaviour of the writing. Nothing here is
  // reproduced or reworded from NESA marking guidelines, performance descriptions
  // or any textbook, and it carries no subject facts, names or dates.
  //
  // Resolution order, highest priority first (see markingContext in app.js):
  //   question.criteria.bands  ->  subject.bandExpectations.bands  ->  this
  // `criteria.bands: null` on a question means "fall through", which is normal.
  // ---------------------------------------------------------------------------
  // ---------------------------------------------------------------------------
  // answerShapes — what a response has to DO, shown before the student writes,
  // on every written question: a study card, a question in a paper, an essay.
  //
  // Content-free by construction. Every row names a job, never a fact, never a
  // sentence, so the same rows are correct in any subject and for any topic. The
  // app states the job; the student writes every word.
  //
  // `commands` is keyed by the HSC directive verb, because a two-mark Identify and
  // a fifteen-mark Evaluate are not the same task and must not be handed the same
  // five lines. `fallback` covers a verb we do not recognise, and a question that
  // opens with no verb at all.
  // ---------------------------------------------------------------------------
  answerShapes: {
    // An extended response written in one go, so the shape is the whole response
    // rather than one paragraph. Essay practice uses the per-paragraph slot model
    // instead, which is finer grained.
    extended: [
      { label: "introduction", job: "state the overall line of argument and signpost how the response will get there" },
      { label: "each body paragraph", job: "make one argument, explain how it works, ground it in specific evidence, then link back to the question" },
      { label: "conclusion", job: "answer the question outright and weigh it, with no new evidence" }
    ],
    commands: {
      identify:   [{ label: "name it", job: "name what the question asks for and nothing else. No explanation is being asked for" }],
      list:       [{ label: "name them", job: "name each one the question asks for, briefly and separately" }],
      outline:    [{ label: "name it", job: "name what the question asks for" },
                   { label: "main features", job: "give its main features in a sentence, without going into why" }],
      describe:   [{ label: "name it", job: "name what the question asks for" },
                   { label: "features", job: "set out its characteristics or how it works in practice" }],
      explain:    [{ label: "name it", job: "name the thing the question asks about" },
                   { label: "how or why", job: "say how it works or why it happens, as cause and effect, not as a description" }],
      analyse:    [{ label: "the parts", job: "identify the components or factors the question points at" },
                   { label: "the relationship", job: "show how they act on each other and what follows from that" }],
      compare:    [{ label: "both sides", job: "set out each one on the same terms, so they can be held against each other" },
                   { label: "similarities and differences", job: "state where they are alike and where they part, rather than describing each in turn" }],
      distinguish:[{ label: "each one", job: "state what each one is, in the same terms" },
                   { label: "the difference", job: "name the difference itself, plainly" }],
      assess:     [{ label: "position", job: "state the judgement the question is asking you to make" },
                   { label: "reasons", job: "give the reasons that support it, each tied to evidence" },
                   { label: "the other side", job: "acknowledge what weighs against it, briefly" },
                   { label: "judgement", job: "land the judgement, weighed rather than absolute" }],
      evaluate:   [{ label: "criteria", job: "say what you are judging it against" },
                   { label: "strengths", job: "give what works, tied to evidence" },
                   { label: "limitations", job: "give what does not, tied to evidence" },
                   { label: "judgement", job: "land a clear judgement against the criteria you set" }],
      discuss:    [{ label: "the issue", job: "set out what is at stake in the question" },
                   { label: "one side", job: "give the case for, with evidence" },
                   { label: "the other side", job: "give the case against, with evidence" },
                   { label: "where you land", job: "state your position on the balance of it" }],
      justify:    [{ label: "the position", job: "state the position you are defending" },
                   { label: "reasons", job: "give the reasons it holds, tied to evidence" },
                   { label: "why not the alternative", job: "say why a reasonable alternative is weaker" }],
      recommend:  [{ label: "the recommendation", job: "state plainly what should be done" },
                   { label: "why", job: "give the reasoning that makes it the right call here" },
                   { label: "what it depends on", job: "name the condition or trade-off it rests on" }],
      propose:    [{ label: "the proposal", job: "state what you are proposing" },
                   { label: "how it works", job: "explain the mechanism, not just the intention" },
                   { label: "why it fits", job: "tie it to the situation the question describes" }],
      demonstrate:[{ label: "the claim", job: "state what you are showing to be true" },
                   { label: "the working", job: "show it step by step, so each step follows from the last" }],
      examine:    [{ label: "the elements", job: "set out the parts the question asks you to look at" },
                   { label: "how they work", job: "explain each one in turn, in cause and effect terms" },
                   { label: "what it amounts to", job: "say what the whole picture shows" }],
      "account for": [{ label: "what happened", job: "state the thing to be accounted for" },
                   { label: "the causes", job: "give the reasons it came about, ranked by weight" },
                   { label: "why those", job: "say why those causes rather than others" }],
      "to what extent": [{ label: "your position", job: "state how far you think it holds, in the question's own terms" },
                   { label: "where it holds", job: "give the case for, with evidence" },
                   { label: "where it does not", job: "give the limits, with evidence" },
                   { label: "the measure", job: "land a judgement about how far, not simply whether" }],
      "how can":  [{ label: "the ways", job: "name the ways the question asks about" },
                   { label: "how each works", job: "explain the mechanism of each, in cause and effect terms" },
                   { label: "the effect", job: "say what each one achieves for the outcome in the question" }]
    },
    fallback: [
      { label: "answer it", job: "answer the question that was actually asked, in its own terms" },
      { label: "support it", job: "back the answer with specific evidence rather than assertion" }
    ],
    // Added in code when the question carries a stimulus. Never asserts what the
    // stimulus says: it only says the response has to use it.
    stimulus: { label: "use the source", job: "draw on the material given with the question, rather than answering from general knowledge alongside it" }
  },

  bandExpectations: {
    source: "general HSC band expectations",
    bands: [
      { range: "Band 6", text: "The response answers the exact question asked and holds one judgement from the first paragraph to the last. Evidence is chosen because it proves the point being made, and the writing says what it proves. Subject terms carry the reasoning instead of decorating it. Each paragraph builds on the one before it, so the whole reads as a single line of thought." },
      { range: "Band 5", text: "The response answers the question and keeps its line of argument to the end, with only brief drops into retelling. Evidence is specific and is explained, though one or two examples do less work than the rest. Subject terms are accurate and are used where they matter. The paragraphs are ordered on purpose and the joins between them are easy to follow." },
      { range: "Band 4", text: "The response takes a position, but that position is stated more often than it is proved. Evidence is relevant and mostly accurate, though some of it is dropped in and left to speak for itself. Subject terms appear and are broadly right, with a few used loosely. The paragraphs are organised, but they read more as a list of points than as one argument." },
      { range: "Band 3", text: "An answer to the question is present but it is not held steadily, and parts of the response drift onto a nearby topic instead. Explanation gives way to description for long stretches, and evidence is named without being tied to the point it is meant to support. Subject terms appear, sometimes only as labels. The paragraphs could be reordered without much being lost." },
      { range: "Band 2", text: "The response stays close to the topic rather than to the question, and retells what the student knows instead of arguing a case. Evidence is thin, general or repeated, and its relevance is assumed rather than shown. Only a few subject terms are used and some are used wrongly. The writing moves from one point to the next without connecting them." },
      { range: "Band 1", text: "The response touches the topic but does not take up the question. Statements stay general and are not developed, and there is little evidence beyond what is asserted. Subject terms are mostly absent or are used incorrectly. The writing is fragmentary or circles one idea, so there is no line of argument for a marker to follow." }
    ]
  },

  bands: [
    { range: "Bands 5 to 6", text: "Sustained, well reasoned judgement. Analysis runs ahead of description, evidence is integrated and specific, and the writing signposts clearly." },
    { range: "Bands 3 to 4", text: "A clear line of argument with some analysis, but parts slip into retelling and the evidence is uneven or loosely linked." },
    { range: "Bands 1 to 2", text: "Mostly description or general comment, with little argument and evidence that is thin, vague or unconnected to the question." }
  ],

  // ---------------------------------------------------------------------------
  // coachSample — the labelled DEMO FALLBACK for coaching, mirroring the marking
  // demo fallback (demoEssay). Lets all three screens be walked end to end before
  // the worker is re-pasted. SUGGEST, NEVER SUBSTITUTE: nudges are questions, not
  // answers; chips are word-level alternatives the student picks and applies.
  // Never a rewritten sentence or a paste-ready paragraph.
  // ---------------------------------------------------------------------------
  // ---------------------------------------------------------------------------
  // slots — the ONE shared paragraph model. Both the missing-element checker (the
  // coach names which slot is ABSENT) and the quiz "complete enough" check read
  // this. A body paragraph has four slots; intro and conclusion get light sets.
  // The "job" text is what the app shows on a missing-element card, so the coach
  // worker never has to write that text (it returns only the slot key).
  //
  // templates are the TIERED, CONTENT-FREE frames a student can toggle on a
  // missing-element card. HARD RULE: blank connective tissue only, NEVER a worked
  // example with real history, names, dates or model analysis. tier1 is one simple
  // frame; tier2 offers a few frame TYPES that scaffold the KIND of analysis.
  // Keep the slot KEYS here in sync with proxy/worker.js COACH_SYSTEM.
  // ---------------------------------------------------------------------------
  slots: {
    roleSets: {
      body: [
        { key: "point",    label: "point",     job: "state the argument this paragraph makes" },
        { key: "analysis", label: "analysis",  job: "explain the effect or why it matters" },
        { key: "evidence", label: "evidence",  job: "ground the point in a specific source or detail" },
        { key: "link",     label: "link",      job: "connect the point back to the question" }
      ],
      introduction: [
        { key: "thesis",  label: "thesis",   job: "state your overall line of argument" },
        { key: "methods", label: "approach", job: "signpost how the essay will get there" }
      ],
      conclusion: [
        { key: "restate",   label: "restatement", job: "draw the argument together without simply repeating" },
        { key: "judgement", label: "judgement",   job: "land a clear, weighed judgement" }
      ]
    },
    templates: {
      point:     { tier1: "____ was a key way that ____.",
                   tier2: [ { type: "claim", frame: "One way ____ can be seen is through ____." },
                            { type: "contrast", frame: "While ____, this paragraph argues that ____." } ] },
      analysis:  { tier1: "This demonstrates that ____ because ____.",
                   tier2: [ { type: "significance", frame: "This was significant because it allowed ____ to ____, which shows ____." },
                            { type: "appearance and reality", frame: "This created the impression of ____ while in reality ____, revealing ____." },
                            { type: "cause and effect", frame: "By doing this, ____ led to ____." } ] },
      evidence:  { tier1: "This is supported by ____, which shows ____.",
                   tier2: [ { type: "named source", frame: "According to ____, ____, which suggests ____." },
                            { type: "specific detail", frame: "The detail that ____ shows ____." } ] },
      link:      { tier1: "Therefore, ____ was a key method because ____.",
                   tier2: [ { type: "answer the question", frame: "This shows that ____, which directly addresses ____." },
                            { type: "weigh it", frame: "This mattered more than ____ because ____." } ] },
      thesis:    { tier1: "____ can be assessed by weighing ____ against ____.",
                   tier2: [ { type: "line of argument", frame: "While ____, ultimately ____ because ____." } ] },
      methods:   { tier1: "This will be shown through ____ and ____.",
                   tier2: [ { type: "signpost", frame: "By examining ____ and ____, this essay will argue ____." } ] },
      restate:   { tier1: "Overall, ____ shows that ____.",
                   tier2: [ { type: "draw together", frame: "Taken together, ____ and ____ reveal ____." } ] },
      judgement: { tier1: "On balance, ____ was ____ because ____.",
                   tier2: [ { type: "weighed judgement", frame: "Although ____, on balance ____ because ____." } ] }
    },
    // Worked examples for the optional "see a worked example" reference. These are
    // FIXED, pre-written (never generated, so no invented history), and ALWAYS on a
    // DIFFERENT topic from the student's, so the analytical SHAPE transfers but no
    // content is liftable into their own essay. Shown only in a separate reference
    // panel labelled "model to study, not to copy". Two topics are provided so the
    // app can pick the one that does NOT match the student's chosen topic. Original
    // wording, general and uncontroversial, never reproduced from any source.
    //
    // This list is the SUBJECT-AGNOSTIC FALLBACK (authored for Ancient History). Any
    // other subject borrows it as a clearly-labelled placeholder. To give a subject
    // its OWN worked examples later, add `examples: [ ... ]` (same shape) under that
    // subject in `subjects.<key>` above; the app prefers a subject's own set and
    // drops the placeholder note automatically. No engine change is needed.
    examples: [
      { topic: "sparta", label: "Spartan society", slots: {
        point: "Spartan upbringing was designed above all to produce obedient soldiers.",
        analysis: "This mattered because the agoge took boys from their families young, which shows the state placed loyalty to Sparta above loyalty to kin.",
        evidence: "This is supported by descriptions of the agoge as harsh communal training from about the age of seven, which suggests how early the conditioning began.",
        link: "This addresses the question because it shows control was built through upbringing, not through force alone.",
        thesis: "Spartan society can be assessed by weighing its military strength against the rigidity that strength demanded.",
        methods: "This will be examined through Spartan education, the role of the helots, and the place of women.",
        restate: "Overall, Spartan strength and Spartan rigidity were two sides of one system.",
        judgement: "On balance, the system was effective for war but slow to adapt, which limited Sparta over time."
      } },
      { topic: "egypt", label: "Old Kingdom Egypt", slots: {
        point: "In the Old Kingdom, the pharaoh's authority rested on his presentation as a divine ruler.",
        analysis: "This mattered because commanding the resources to build the pyramids displayed that power, which shows religion and royal authority reinforced each other.",
        evidence: "This is supported by the scale of the pyramid complexes at Giza, which suggests the level of organisation the state could reach.",
        link: "This addresses the question because it shows authority was expressed through monuments as much as through administration.",
        thesis: "Old Kingdom Egypt can be assessed by weighing the power of the pharaoh against the burden such projects placed on the state.",
        methods: "This will be examined through kingship, religion, and the organisation of labour.",
        restate: "Overall, royal power and religious belief in the Old Kingdom were deeply intertwined.",
        judgement: "On balance, this concentration of power enabled great works but left the state vulnerable when central authority weakened."
      } }
    ]
  },

  // coachSample — the labelled DEMO FALLBACK, in the categorised shape the worker
  // now returns: a substance note, ABSENT slots (each renders a missing-element
  // card with the tiered frames above), and nudges tagged so on-target substance
  // shows by default while expression and signposting polish tuck away. Chips stay
  // word-level. Nothing here contains real history: it is all content-free.
  coachSample: {
    note: "There is a clear point and a source here, but the paragraph leans on description. The marker wants analysis that answers the question.",
    missing: [ { slot: "analysis" }, { slot: "link" } ],
    nudges: [
      { text: "Your source is named, but what does it let you argue about the question?", category: "on_target" },
      { text: "What is the effect of this for your overall line of argument?", category: "on_target" },
      { text: "Could a clearer signpost open this paragraph so the marker sees the point first?", category: "signposting" },
      { text: "Is there a more precise word than this one for what you mean here?", category: "expression" }
    ],
    chips: [
      { from: "shows", options: ["suggests", "indicates", "reveals"] },
      { from: "big", options: ["significant", "substantial", "far-reaching"] },
      { from: "a lot of", options: ["considerable", "extensive"] }
    ],
    check: "If you have stated a date or figure, check it against your own notes before you rely on it.",
    // Line-by-line demo: the coach names the fault in a specific sentence directly,
    // then hands over a blank frame. Never the improved sentence. The client matches
    // "quote" against the student's own text, so these are generic openers that will
    // usually miss in the demo; the app falls back to the paragraph's first sentences.
    lines: [
      { quote: "", issue: "This sentence describes what happened instead of explaining why it matters.", fix: "This shows ____ because ____.", severity: "critical" },
      { quote: "", issue: "There is a claim here with no evidence attached to it.", fix: "This is supported by ____, which shows ____.", severity: "should" },
      { quote: "", issue: "This sentence never links back to the question.", fix: "Therefore ____, which addresses ____.", severity: "should" }
    ]
  }
};
