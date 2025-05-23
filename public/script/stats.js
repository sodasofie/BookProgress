import { fetchUser } from './global.js';

document.addEventListener("DOMContentLoaded", async () => {
  await fetchUser();

  const res = await fetch("/stats", { credentials: "include" });
  const stats = await res.json();

  document.getElementById("total-hours").textContent = Math.round(stats.totalHours);
  document.getElementById("total-minutes").textContent = Math.round(stats.totalHours * 60);

  document.getElementById("count-read").textContent = stats.read;
  document.getElementById("count-reading").textContent = stats.reading;
  document.getElementById("count-notstarted").textContent = stats.notStarted;

  const correctedAbbreviations = {
    "Січ": "Січ", "Лют": "Лют", "Бер": "Бер",
    "Кві": "Квіт", "Тра": "Трав", "Чер": "Чер",
    "Лип": "Лип", "Сер": "Сер", "Вер": "Вер",
    "Жов": "Жов", "Лис": "Лис", "Гру": "Груд"
  };

  const fullFromShort = {
    "Січ": "Січень", "Лют": "Лютий", "Бер": "Березень",
    "Квіт": "Квітень", "Трав": "Травень", "Чер": "Червень",
    "Лип": "Липень", "Сер": "Серпень", "Вер": "Вересень",
    "Жов": "Жовтень", "Лис": "Листопад", "Груд": "Грудень"
  };

  const MONTH_IDX = {
    "Січ": 0, "Лют": 1, "Бер": 2, "Квіт": 3, "Трав": 4, "Чер": 5,
    "Лип": 6, "Сер": 7, "Вер": 8, "Жов": 9, "Лис": 10, "Груд": 11
  };

  const monthEntries = Object.entries(stats.months)
    .map(([key, value]) => {
      const [year, raw] = key.split(/[-–]/);
      const abbrRaw = raw.trim();
      const abbr = correctedAbbreviations[abbrRaw] || abbrRaw;
      const idx = MONTH_IDX[abbr];

      if (idx == null) return null;

      const date = new Date(+year, idx, 1);
      return { key, value, date };
    })
    .filter(entry => entry !== null)
    .sort((a, b) => a.date - b.date)
    .map(({ key, value }) => [key, value]);

  const monthLabels = monthEntries.map(([key]) => {
    const [year, abbrRaw] = key.split(/[-–]/);
    const abbr = abbrRaw.trim();
    const corr = correctedAbbreviations[abbr] || abbr;
    return `${year}-${corr}`;
  });
  const monthValues = monthEntries.map(([, v]) => Math.round(v));
  const tooltipMap = monthEntries.reduce((acc, [key, _]) => {
    const [year, abbrRaw] = key.split(/[-–]/);
    const abbr = abbrRaw.trim();
    const full = fullFromShort[abbr] || abbr;
    acc[`${year}-${(correctedAbbreviations[abbr] || abbr)}`] = `${year}-${full}`;
    return acc;
  }, {});


  const canvas = document.getElementById("chart-pages");
  canvas.style.minWidth = `${monthLabels.length * 86}px`;

  const canvasPages = document.getElementById("chart-pages");
  const noPagesText = document.getElementById("no-pages");
  const hasPageStats = monthValues.some(val => val > 0);

  if (hasPageStats) {
    noPagesText.style.display = "none";
    canvasPages.style.display = "block";

    new Chart(canvasPages, {
      type: "bar",
      data: {
        labels: monthLabels,
        datasets: [{
          label: "Сторінки за місяць",
          data: monthValues,
          backgroundColor: "#f3c5d2",
          hoverBackgroundColor: "#d3879d"
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: {
            mode: 'nearest',
            intersect: false,
            bodyFont: {
              size: 16
            },
            titleFont: {
              size: 16
            },
            callbacks: {
              title: function (context) {
                const label = context[0].label;
                return tooltipMap[label] || label;
              },
              label: function (context) {
                return `Сторінки за місяць: ${context.raw}`;
              }
            }
          }
        },
        scales: {
          x: {
            ticks: {
              autoSkip: false,
              font: {
                size: 14
              },
              color: "#404040"
            },
          },
          y: {
            beginAtZero: true,
            ticks: {
              stepSize: 25,
              font: {
                size: 14
              }
            }
          }
        }
      }
    });
  } else {
    canvasPages.style.display = "none";
    noPagesText.style.display = "block";
  }


  const genreMap = {
    poetry: 'Вірші / Поезія',
    detective: 'Детектив',
    drama: 'Драма',
    horror: 'Жахи',
    fairy_tale: 'Казка',
    comedy: 'Комедія / Гумор',
    adventure: 'Пригоди',
    novel: 'Роман',
    romance: 'Романтика',
    thriller: 'Трилер',
    sci_fi: 'Фантастика',
    fantasy: 'Фентезі',
    biography: 'Біографія',
    documentary: 'Документалістика',
    history: 'Історія',
    culture: 'Культура',
    art: 'Мистецтво',
    science: 'Наука',
    political_lit: 'Політична література',
    psychology: 'Психологія / Саморозвиток',
    journalism: 'Публіцистика',
    religious_lit: 'Релігійна література',
    philosophy: 'Філософія'
  };

  const genreColorMap = {
    poetry: "#e4a5a4",
    detective: "#e4b5a4",
    drama: "#e4c6a4",
    horror: "#e4d7a4",
    fairy_tale: "#dfe4a4",
    comedy: "#cde4a4",
    adventure: "#bde4a4",
    novel: "#abe4a4",
    romance: "#a4e4bd",
    thriller: "#a4e4ce",
    sci_fi: "#a4e4e0",
    fantasy: "#a4d6e4",
    biography: "#a4cce4",
    documentary: "#a4c5e4",
    history: "#a4b4e4",
    culture: "#a4a4e4",
    art: "#b3a4e4",
    science: "#bca4e4",
    political_lit: "#c5a4e4",
    psychology: "#d6a4e4",
    journalism: "#e4a4e0",
    religious_lit: "#e4a4e0",
    philosophy: "#e4a4be"
  };


  const genreLabels = Object.keys(stats.genres);
  const genreCounts = Object.values(stats.genres);

  const genreDisplayNames = genreLabels.map(key => genreMap[key] || key);

  const hoverColors = genreLabels.map((_, i) =>
    `hsl(${i * 360 / genreLabels.length}, 75%, 65%)`
  );

  function getBookWord(count) {
    if (count % 10 === 1 && count % 100 !== 11) return "книга";
    if ([2, 3, 4].includes(count % 10) && ![12, 13, 14].includes(count % 100)) return "книги";
    return "книг";
  }

  const genreChartEl = document.getElementById("chart-genres");
  const genreMsg = document.getElementById("no-genres");

  if (genreLabels.length > 0) {
    genreMsg.style.display = "none";

    const colors = genreLabels.map(key => genreColorMap[key] || "#cccccc");
    const hoverColors = colors.map(c => c); 

    new Chart(genreChartEl, {
      type: "pie",
      data: {
        labels: genreDisplayNames,
        datasets: [{
          data: genreCounts,
          backgroundColor: colors,
          hoverBackgroundColor: hoverColors
        }]
      },
      options: {
        responsive: true,
        plugins: {
          legend: {
            position: "bottom",
            labels: {
              font: {
                size: 16
              },
              color: "#404040"
            },
          },
          tooltip: {
            mode: 'nearest',
            intersect: false,
            bodyFont: { size: 16 },
            titleFont: { size: 16 },
            callbacks: {
              label: function (context) {
                const genre = context.label;
                const count = context.raw;
                const word = getBookWord(count);
                return `${genre} (${count} ${word})`;
              }
            }
          }
        }
      }
    });
  } else {
    genreMsg.style.display = "block";
  }


  const chartsWrapper = document.getElementById('charts-wrapper');
  const emptyStats = document.getElementById('empty-stats');

  fetch('/books', { credentials: 'include' })
    .then(res => res.json())
    .then(books => {
      if (books.length === 0) {
        chartsWrapper.style.display = 'none';
        emptyStats.style.display = 'block';
      } else {
        emptyStats.style.display = 'none';
        chartsWrapper.style.display = '';
        return fetch('/stats', { credentials: 'include' });
      }
    })
    .then(res => res && res.json())
    .then(stats => {
      if (!stats) return;
    })
    .catch(err => console.error(err));

});


