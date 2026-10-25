export function getGroupedCart(){
  let cart = JSON.parse(localStorage.getItem('userCart')) || {};
  const cartItems = Object.values(cart); // Convert object to array

  const groupedCart = cartItems.reduce((acc, { item, quantity }) => {
        if (item?.price?.displayPrice === undefined || item.price.displayPrice === null || !item.name) return acc;
        const restaurant = item.restaurant || 'Unknown Restaurant';
        acc[restaurant] = acc[restaurant] || [];
        acc[restaurant].push({ item, quantity });
        return acc;
    }, {});

    return groupedCart;
}

export function setupCartDropdownToggle(cartLinkContainer,cartDropdown) {
        if (!cartLinkContainer) return;

        cartLinkContainer.addEventListener('click', (e) => {
            if((Object.keys(getGroupedCart()).length <= 1)){
                cartLinkContainer.classList.remove('drop');
                return;
            }
            e.stopPropagation();
            e.preventDefault();
            cartLinkContainer.classList.toggle('dropdown-active');
        });

        window.addEventListener('click', () => {
            if (cartLinkContainer.classList.contains('dropdown-active')) {
                cartLinkContainer.classList.remove('dropdown-active');
            }
        });
        if (cartDropdown) {
            cartDropdown.addEventListener('click', (e) => {
                e.stopPropagation(); 
            });
        }
    }