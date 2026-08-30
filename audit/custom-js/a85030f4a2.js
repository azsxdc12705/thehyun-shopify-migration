// pages: /available-cuts
document.addEventListener('DOMContentLoaded', function () {
  if (window.location.pathname !== '/available-cuts') return;
  document.querySelectorAll('.category-section').forEach(function(section){
    if (section.querySelector('.w-dyn-empty')) section.style.display = 'none';
  });
});